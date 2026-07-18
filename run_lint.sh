#!/bin/bash
npm run lint > lint_output.txt 2>&1
cat lint_output.txt
