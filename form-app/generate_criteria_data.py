import json
import re
from pathlib import Path
from zipfile import ZipFile

from lxml import etree

SOURCE = Path(r"C:\Users\Azzam\Desktop\Qaras\استمارة الزيارة الفنية لمديري المدارس وفق  نموذج تقييم اداء مديري المدارس-1448هـ .docx")
OUTPUT = Path(r"C:\Users\Azzam\Desktop\Qaras\form-app\dist\criteria-data.js")
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def text_of(node):
    return " ".join(" ".join(node.xpath(".//w:t/text()", namespaces=NS)).split())


def clean(value):
    value = value.replace("", " ")
    value = re.sub(r"\s+([،,.])", r"\1", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip(" -")


with ZipFile(SOURCE) as archive:
    root = etree.fromstring(archive.read("word/document.xml"))

criteria = []
for table in root.xpath(".//w:tbl", namespaces=NS)[3:22]:
    rows = table.xpath("./w:tr", namespaces=NS)
    first_cells = rows[0].xpath("./w:tc", namespaces=NS)
    number_digits = re.sub(r"\D", "", text_of(first_cells[0]))
    if not number_digits:
        continue
    number = int(number_digits)
    title = clean(text_of(first_cells[1]))
    evidence_text = " ".join(text_of(cell) for cell in first_cells[3:])
    evidence = [clean(item) for item in re.split(r"", evidence_text) if clean(item)]
    descriptors = []
    for row in rows[2:7]:
        cells = row.xpath("./w:tc", namespaces=NS)
        values = [clean(text_of(cell)) for cell in cells]
        values = [value for value in values if value and value not in {""}]
        descriptor = max(values, key=len, default="")
        descriptors.append(descriptor)
    criteria.append({
        "id": number,
        "title": title,
        "weight": 10 if number == 13 else 5,
        "evidence": evidence,
        "levels": descriptors,
    })

criteria.sort(key=lambda item: item["id"])
OUTPUT.write_text("window.QARAS_CRITERIA = " + json.dumps(criteria, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
print(f"wrote {len(criteria)} criteria to {OUTPUT}")
