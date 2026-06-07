#!/usr/bin/env python3
"""Simple greeting tool."""
import sys
import argparse

parser = argparse.ArgumentParser(description="Generate greeting messages")
parser.add_argument("--name", required=True, help="Name to greet")
parser.add_argument("--times", type=int, default=1, help="Repeat count")
parser.add_argument("--uppercase", action="store_true", help="Uppercase output")

args = parser.parse_args()

for i in range(args.times):
    msg = f"Hello, {args.name}! 👋 (iteration {i+1}/{args.times})"
    if args.uppercase:
        msg = msg.upper()
    print(msg)

print(f"\nTotal greetings: {args.times}")
