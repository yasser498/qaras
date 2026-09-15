from pathlib import Path
from zipfile import ZipFile
from lxml import etree

SOURCE = Path(r"C:\Users\Azzam\Desktop\Qaras\استمارة الزيارة الفنية لمديري المدارس وفق  نموذج تقييم اداء مديري المدارس-1448هـ .docx")
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

with ZipFile(SOURCE) as archive:
    root = etree.fromstring(archive.read("word/document.xml"))

tables = root.xpath(".//w:tbl", namespaces=NS)
print(f"ALL_TABLES={len(tables)}")
for index, table in enumerate(tables):
    direct_rows = table.xpath("./w:tr", namespaces=NS)
    row_texts = []
    for row in direct_rows[:3]:
        cells = []
        for cell in row.xpath("./w:tc", namespaces=NS):
            texts = cell.xpath(".//w:t/text()", namespaces=NS)
            clean = " ".join(" ".join(texts).split())
            if clean:
                cells.append(clean[:140])
        if cells:
            row_texts.append(" | ".join(cells))
    joined = " || ".join(row_texts)
    print(f"T{index}: rows={len(direct_rows)} {joined[:700]}")
