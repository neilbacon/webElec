function sum(str, end) {
  s = 0
  i = str
  while (i < end) {
    s += $i
    i += 1
  }
  return s
}

BEGIN {
  peak = shoulder = offpeak = 0
}

$1 == 200 { 
  isConsumption = $4 ~ /^E/ 
} 

$1 == 300 && isConsumption {
  if ($2 ~ /^2025((010[6-9])|(011[0,3-7])|(012[0-4,7-9])|(013[01])|(020[34]))/) { // weekday
    offpeak += sum(3, 75)
    peak += sum(75, 99)
    shoulder += sum(99, 195)
    peak += sum(195, 231)
    shoulder += sum(231, 255)
    offpeak += sum(255, 291)
  } else { // weekend
    offpeak += sum(3, 291)
  }
}

END {
  printf "Peak %s kWh\nShoulder %s kWh\nOff-peak %s kWh\n", peak, shoulder, offpeak
}
