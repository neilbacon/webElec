BEGIN {
  sum = 0 
}

$1 == 200 { 
  isConsumption = $4 ~ /^E/ 
} 

$1 == 300 && isConsumption && $2 ~ /^2025((010[6-9])|(011[0,3-7])|(012[0-4,7-9])|(013[01])|(020[34]))/ { 
  i = 75
  while (i < 99) {
    sum += $i
    i +=1
  }
  i = 195
  while (i < 231) {
    sum += $i
    i += 1
  }
}

END {
  print "Peak " sum " kWh"
}
