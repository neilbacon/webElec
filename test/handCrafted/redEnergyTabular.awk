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

$6 == "Export" {
  if ($2 ~ /^((0[6-9] Jan)|(1[0,3-7] Jan)|(2[0-4,7-9] Jan)|(3[01] Jan)|(0[34] Feb)) 2025/) { // weekday
    offpeak += sum(7, 79)
    peak += sum(79, 103)
    shoulder += sum(103, 199)
    peak += sum(199, 235)
    shoulder += sum(235, 259)
    offpeak += sum(259, 295)
  } else { // weekend
    offpeak += sum(7, 295)
  }
}

END {
  printf "Peak %s kWh\nShoulder %s kWh\nOff-peak %s kWh\n", peak, shoulder, offpeak
}
