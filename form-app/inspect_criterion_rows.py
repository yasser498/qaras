from pathlib import Path
from zipfile import ZipFile
from lxml import etree

SOURCE = Path(r"C:\Users\Azzam\Desktop\Qaras\استمارة الزيارة الفنية لمديري المدارس وفق  نموذج تقييم اداء مديري المدارس-1448هـ .docx")
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
with ZipFile(SOURCE) as archive:
    root = etree.fromstring(archive.read("word/document.xml"))

tables = root.xpath(".//w:tbl", namespaces=NS)
for ti in range(3, 22):
    table = tables[ti]
    print(f"\nTABLE {ti}")
    for ri, row in enumerate(table.xpath("./w:tr", namespaces=NS)):
        cells = []
        for ci, cell in enumerate(row.xpath("./w:tc", namespaces=NS)):
            text = " ".join(" ".join(cell.xpath(".//w:t/text()", namespaces=NS)).split())
            cells.append(f"C{ci}={text}")
        print(f"R{ri}: " + " || ".join(cells))
