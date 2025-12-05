#!/usr/bin/env python3
"""
PDF Object Lister
Lists all objects found in a PDF file including pages, images, fonts, and metadata.
"""

import sys
from pathlib import Path

try:
    import PyPDF2
except ImportError:
    print("Error: PyPDF2 is required. Install it with: pip install PyPDF2")
    sys.exit(1)


def list_pdf_objects(pdf_path):
    """List all objects in a PDF file."""
    if not Path(pdf_path).exists():
        print(f"Error: File '{pdf_path}' not found.")
        return
    
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            print(f"\n{'='*60}")
            print(f"PDF: {pdf_path}")
            print(f"{'='*60}\n")
            
            # Basic Information
            print("BASIC INFORMATION:")
            print(f"  Number of pages: {len(pdf_reader.pages)}")
            
            # Metadata
            if pdf_reader.metadata:
                print("\nMETADATA:")
                for key, value in pdf_reader.metadata.items():
                    print(f"  {key}: {value}")
            
            # Page Objects
            print("\nPAGE OBJECTS:")
            for i, page in enumerate(pdf_reader.pages, 1):
                print(f"\n  Page {i}:")
                print(f"    Media Box: {page.mediabox}")
                print(f"    Rotation: {page.get('/Rotate', 0)}°")
                
                # Resources
                if '/Resources' in page:
                    resources = page['/Resources']
                    
                    # Fonts
                    if '/Font' in resources:
                        fonts = resources['/Font']
                        print(f"    Fonts: {len(fonts)} font(s)")
                        for font_name, font_obj in fonts.items():
                            font_type = font_obj.get('/Subtype', 'Unknown')
                            print(f"      - {font_name}: {font_type}")
                    
                    # Images (XObjects)
                    if '/XObject' in resources:
                        xobjects = resources['/XObject']
                        images = [name for name, obj in xobjects.items() 
                                 if obj.get('/Subtype') == '/Image']
                        if images:
                            print(f"    Images: {len(images)} image(s)")
                            for img_name in images:
                                img_obj = xobjects[img_name]
                                width = img_obj.get('/Width', 'Unknown')
                                height = img_obj.get('/Height', 'Unknown')
                                print(f"      - {img_name}: {width}x{height}")
                    
                    # Other resources
                    resource_types = [k for k in resources.keys() if k not in ['/Font', '/XObject']]
                    if resource_types:
                        print(f"    Other Resources: {', '.join(resource_types)}")
            
            # Outline/Bookmarks
            if pdf_reader.outline:
                print("\nOUTLINE/BOOKMARKS:")
                print_outline(pdf_reader.outline, indent=2)
            
            # Form fields
            if pdf_reader.get_fields():
                fields = pdf_reader.get_fields()
                print(f"\nFORM FIELDS: {len(fields)} field(s)")
                for field_name, field_obj in fields.items():
                    field_type = field_obj.get('/FT', 'Unknown')
                    print(f"  - {field_name}: {field_type}")
            
            # Document catalog
            if hasattr(pdf_reader, 'trailer') and '/Root' in pdf_reader.trailer:
                catalog = pdf_reader.trailer['/Root']
                print("\nDOCUMENT CATALOG:")
                for key in catalog.keys():
                    if key not in ['/Type', '/Pages']:
                        print(f"  {key}: {catalog.get(key, 'N/A')}")
            
            print(f"\n{'='*60}\n")
            
    except Exception as e:
        print(f"Error reading PDF: {e}")


def print_outline(outline, indent=0):
    """Recursively print PDF outline/bookmarks."""
    for item in outline:
        if isinstance(item, list):
            print_outline(item, indent + 2)
        else:
            title = item.get('/Title', 'Untitled')
            print(f"{' ' * indent}- {title}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python list_pdf_objects.py <path_to_pdf>")
        print("\nExample:")
        print("  python list_pdf_objects.py document.pdf")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    list_pdf_objects(pdf_path)


if __name__ == "__main__":
    main()

