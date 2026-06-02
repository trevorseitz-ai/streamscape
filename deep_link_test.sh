#!/bin/bash

TESTS=(
  "Netflix|com.netflix.ninja|nflx://www.netflix.com/watch/82650122"
  "Prime Video|com.amazon.amazonvideo.livingroom|amzn://view/details?asin=B0GWHGFJ4J"
  "Tubi|com.tubitv|https://tubitv.com/movies/300006551"
  "Max|com.wbd.stream|https://play.max.com/movie/example"
)

echo "=== ADB Deep Link Tester ==="

for TEST in "${TESTS[@]}"; do
  IFS="|" read -r NAME PACKAGE URL <<< "$TEST"

  echo ""
  echo "------------------------------------"
  echo "Testing: $NAME"
  echo "Package: $PACKAGE"
  echo "URL: $URL"
  echo "------------------------------------"

  adb shell am start \
    -a android.intent.action.VIEW \
    -d "$URL" \
    "$PACKAGE"

  echo ""
  read -p "Did it work? Press Enter for next..."
done

echo "Done."
