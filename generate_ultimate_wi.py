import os
import argparse
from docx.shared import Inches
from doc_utils import setup_doc, add_centered_heading, add_header_table
from doc_utils import add_data_table, add_image, add_image_caption, add_bullets, log


def create_ultimate_wi(media_dir: str, out_path: str) -> None:
    doc = setup_doc()

    img = {
        'PATTERNS': os.path.join(media_dir, 'word/media/image1.jpeg'),
        'FILLET':   os.path.join(media_dir, 'word/media/image2.jpeg'),
        'XRAY':     os.path.join(media_dir, 'word/media/image3.jpeg'),
        'CSAM':     os.path.join(media_dir, 'word/media/image4.jpeg'),
        'NEEDLE':   os.path.join(media_dir, 'word/media/image5.jpeg'),
    }

    add_centered_heading(doc, 'Underfill (底填膠) 作業指導與品質標準書', 0)

    add_header_table(doc, [
        ['文件名稱', 'Underfill Operating Standard', '文件編號', 'WI-QA-UF-3808'],
        ['膠材型號', 'Loctite ECCOBOND UF 3808', '製訂日期', '2026-04-09'],
        ['Ball Pitch', '0.1mm - 1.27mm', 'Die Size', '1.5mm - 45.0mm'],
        ['IPC 級別', 'Class 2 / Class 3', '安全等級', 'Confidential'],
        ['狀態', '工藝優化整合版', '頁數', '1 / 1'],
    ])

    # 1. Material Specs
    doc.add_heading('1. 材料規格與特性 (Loctite UF 3808)', level=1)
    add_data_table(doc,
        ['Parameter', 'Value'],
        [
            ['粘度 (Viscosity)', '348 mPa·s @ 25°C'],
            ['固化推薦 (Cure)', '130°C / 8 min 或 150°C / 5 min'],
            ['Tg (玻璃轉化點)', '113°C'],
            ['CTE 1 / CTE 2', '55 ppm/°C / 171 ppm/°C'],
            ['工作時間 (Pot Life)', '24 h @ 25°C'],
            ['彈性模量 (Modulus)', '2.8 GPa'],
            ['硬度 (Shore D)', '88'],
            ['吸濕率', '< 0.5%'],
        ]
    )

    # 2. Equipment Setup
    doc.add_heading('2. 設備設定與點膠參數', level=1)
    if add_image(doc, img['NEEDLE'], 4.5):
        add_image_caption(doc, '圖 1: 針頭與元件邊距/高度設定基準')
    add_bullets(doc, [
        '針頭規格：23G (BGA) 或 25G-27G (Fine Pitch)',
        '點膠壓力：手動 0.1MPa / 自動閥 0.25MPa',
        '基板預熱：70°C - 90°C',
        '針頭高度：元件頂部下 0.2mm - 0.5mm',
    ])

    # 3. Dispense Patterns
    doc.add_heading('3. 點膠路徑設計與流動引導', level=1)
    if add_image(doc, img['PATTERNS'], 4.5):
        add_image_caption(doc, '圖 2: L 型推薦路徑（兩側推進，對角排氣）')

    doc.add_heading('3.1 元件尺寸矩陣', level=2)
    add_data_table(doc,
        ['類別', 'Die Size (mm)', 'Pitch (mm)', 'Ball Size', '判定'],
        [
            ['BGA', '15~45', '0.65~1.27', '0.35~0.60', '推薦'],
            ['WLCSP', '1.5~8', '0.30~0.50', '0.15~0.25', '強制'],
            ['FlipChip', '2~12', '0.15~0.30', '0.05~0.15', '核心'],
            ['QFN', '< 12', '0.40~0.65', 'N/A', '條件適用'],
            ['Passive', '< 0402', 'N/A', 'N/A', '不建議'],
        ]
    )

    # 4. Quality Standards
    doc.add_heading('4. 品質允收標準 (IPC Standards)', level=1)
    doc.add_heading('4.1 Fillet 目視判定', level=2)
    if add_image(doc, img['FILLET'], 4.2):
        add_image_caption(doc, '圖 3: Fillet 高度合格標準 (50%-75% 元件高度)')

    doc.add_heading('4.2 內部空洞 (X-Ray 判定)', level=2)
    if add_image(doc, img['XRAY'], 4.0):
        add_image_caption(doc, '圖 4: X-Ray 空洞判定 (總面積 < 25%)')

    doc.add_heading('4.3 分層檢測 (CSAM)', level=2)
    if add_image(doc, img['CSAM'], 4.2):
        add_image_caption(doc, '圖 5: CSAM 分層缺陷比對')

    # 5. Troubleshooting
    doc.add_heading('5. 異常分析與對策', level=1)
    add_data_table(doc,
        ['異常', '根因', '對策'],
        [
            ['Fillet 不連續', '膠材回溫不足或雜質阻塞', '落實 2h 回溫；更換過濾針頭'],
            ['內部大氣泡', 'PCB 未預烤', '100°C / 1.5h 預烤'],
            ['組件偏位', '點膠壓力過大', '調降初壓力；增加避讓間距'],
            ['滲透不全', '基板預熱偏差', '校準加熱台，確保達 80°C'],
        ]
    )

    doc.save(out_path)
    log.info(f'Saved: {os.path.abspath(out_path)}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate Underfill Work Instruction')
    parser.add_argument('--media', default='extracted_images',
                        help='Path to extracted media directory')
    parser.add_argument('--output', default='Outputs/Underfill_作業標準書.docx',
                        help='Output DOCX path')
    args = parser.parse_args()
    create_ultimate_wi(args.media, args.output)
