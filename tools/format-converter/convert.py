#!/usr/bin/env python3
"""Convert between JSON, CSV, YAML, and XML data formats."""
import sys
import json
import csv
import io
import argparse
from xml.etree import ElementTree as ET

def json_to_csv(data: str) -> str:
    """Convert JSON array to CSV."""
    rows = json.loads(data)
    if not isinstance(rows, list):
        rows = [rows]
    if not rows:
        return ""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()

def csv_to_json(data: str) -> str:
    """Convert CSV to JSON array."""
    reader = csv.DictReader(io.StringIO(data))
    rows = list(reader)
    return json.dumps(rows, indent=2, ensure_ascii=False)

def json_to_xml(data: str) -> str:
    """Convert JSON to basic XML."""
    obj = json.loads(data)
    def to_xml(parent, obj, tag="root"):
        if isinstance(obj, dict):
            elem = ET.SubElement(parent, tag)
            for k, v in obj.items():
                to_xml(elem, v, k)
        elif isinstance(obj, list):
            elem = ET.SubElement(parent, tag)
            for item in obj:
                to_xml(elem, item, "item")
        else:
            elem = ET.SubElement(parent, tag)
            elem.text = str(obj)
        return elem
    root = ET.Element("root")
    to_xml(root, obj, "root")
    ET.indent(root, space="  ")
    return ET.tostring(root, encoding="unicode")

def xml_to_json(data: str) -> str:
    """Convert XML to JSON."""
    root = ET.fromstring(data)
    def parse(elem):
        result = {}
        for child in elem:
            result[child.tag] = parse(child) if len(child) > 0 else child.text
        return result if result else (elem.text or "")
    return json.dumps(parse(root), indent=2, ensure_ascii=False)

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

def main():
    parser = argparse.ArgumentParser(description="Convert between data formats")
    parser.add_argument("--input_type", required=True, choices=["json","csv","yaml","xml"])
    parser.add_argument("--output_type", required=True, choices=["json","csv","yaml","xml"])
    parser.add_argument("--input_data", default="")
    parser.add_argument("--input_file", default="")
    parser.add_argument("--pretty", action="store_true", default=True)
    args = parser.parse_args()

    if args.input_type == args.output_type:
        print("Input and output formats are the same. Nothing to convert.")
        return

    # Get input data
    data = args.input_data
    if not data and args.input_file:
        with open(args.input_file, "r", encoding="utf-8") as f:
            data = f.read()

    if not data:
        print("Error: No input data provided. Use --input_data or --input_file.", file=sys.stderr)
        sys.exit(1)

    if args.input_type == "yaml" and not HAS_YAML:
        print("Error: pyyaml is not installed. Run: pip install pyyaml", file=sys.stderr)
        sys.exit(1)
    if args.output_type == "yaml" and not HAS_YAML:
        print("Error: pyyaml is not installed. Run: pip install pyyaml", file=sys.stderr)
        sys.exit(1)

    # Parse input to intermediate Python object
    if args.input_type == "json":
        obj = json.loads(data)
    elif args.input_type == "yaml":
        obj = yaml.safe_load(data)
    elif args.input_type == "csv":
        obj = list(csv.DictReader(io.StringIO(data)))
    elif args.input_type == "xml":
        obj = data  # Keep as string for conversion
    else:
        obj = data

    # Convert intermediate to output format
    if args.output_type == "json":
        if args.input_type == "csv":
            result = data  # csv_to_json already done above via intermediate
            result = json.dumps(list(csv.DictReader(io.StringIO(data))), indent=2 if args.pretty else None, ensure_ascii=False)
        elif args.input_type == "xml":
            result = xml_to_json(data)
        else:
            result = json.dumps(obj, indent=2 if args.pretty else None, ensure_ascii=False)
    elif args.output_type == "csv":
        if isinstance(obj, list):
            result = json_to_csv(json.dumps(obj, ensure_ascii=False))
        elif isinstance(obj, dict):
            result = json_to_csv(json.dumps([obj], ensure_ascii=False))
        else:
            result = str(obj)
    elif args.output_type == "yaml":
        result = yaml.dump(obj, allow_unicode=True, sort_keys=False)
    elif args.output_type == "xml":
        if args.input_type == "json":
            result = json_to_xml(data)
        elif isinstance(obj, (dict, list)):
            result = json_to_xml(json.dumps(obj, ensure_ascii=False))
        else:
            result = str(obj)
    else:
        result = str(obj)

    print(result)

if __name__ == "__main__":
    main()
