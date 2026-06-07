import zipfile
import os

def extract_media(docx_path, out_dir):
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)
    with zipfile.ZipFile(docx_path, 'r') as z:
        for f in z.namelist():
            if f.startswith('word/media/'):
                z.extract(f, out_dir)
                print(f"Extracted: {f}")

if __name__ == "__main__":
    extract_media(
        r'C:\Users\user\Desktop\Underfill\Underfill_Operator_Process_Guide_International_Summary.docx',
        r'C:\Users\user\Desktop\Underfill\extracted_images'
    )
