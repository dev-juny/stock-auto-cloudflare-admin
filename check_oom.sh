#!/bin/bash
sudo dmesg | grep -i "oom\|kill" | tail -10
