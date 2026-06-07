#!/usr/bin/env python3
"""Convert text file encoding."""
import sys
import os
import argparse
import chardet

def main():
    parser = argparse.ArgumentParser(description="Convert text file encoding")
    parser.add_argument("--input_file", required=True, help="File to convert")
    parser.add_argument("--to_encoding", required=True, help="Target encoding")
    parser.add_argument("--from_encoding", default="auto", help="Source encoding (auto for detection)")
    args = parser.parse_args()

    if not os.path.isfile(args.input_file):
        print(f"Error: File not found: {args.input_file}", file=sys.stderr)
        sys.exit(1)

    # Read raw bytes
    with open(args.input_file, "rb") as f:
        raw = f.read()

    if len(raw) == 0:
        print("File is empty. Nothing to convert.")
        return

    # Detect encoding if auto
    from_enc = args.from_encoding
    if from_enc == "auto":
        result = chardet.detect(raw)
        from_enc = result["encoding"] or "utf-8"
        confidence = result["confidence"] * 100
        print(f"[Detect] Source encoding: {from_enc} (confidence: {confidence:.0f}%)")
    else:
        print(f"[Manual] Source encoding: {from_enc}")

    # Decode
    try:
        text = raw.decode(from_enc)
    except (UnicodeDecodeError, LookupError) as e:
        print(f"Error decoding with {from_enc}: {e}", file=sys.stderr)
        print("Try specifying a different source encoding with --from_encoding", file=sys.stderr)
        sys.exit(1)

    # Generate output filename
    base, ext = os.path.splitext(args.input_file)
    enc_suffix = args.to_encoding.replace("-", "").replace("_", "")
    out_path = f"{base}.{enc_suffix}{ext}"

    # Encode and write
    try:
        with open(out_path, "w", encoding=args.to_encoding, errors="replace") as f:
            f.write(text)
    except LookupError:
        print(f"Error: Unknown target encoding: {args.to_encoding}", file=sys.stderr)
        sys.exit(1)

    in_size = os.path.getsize(args.input_file)
    out_size = os.path.getsize(out_path)

    print(f"\n========== Conversion Complete ==========")
    print(f"  Source: {os.path.basename(args.input_file)} ({from_enc}, {in_size:,} bytes)")
    print(f"  Output: {os.path.basename(out_path)} ({args.to_encoding}, {out_size:,} bytes)")
    print(f"  Characters: {len(text):,}")


if __name__ == "__main__":
    main()
