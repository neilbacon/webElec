# When WebElec and your Bill Don't Agree
I want to check the peak calculation of 17 kWh on my Red Energy bill from 05 January 2025 to 04 February 2025, because WebElec says it was 16.293 kWh. The vast majority of the numbers do agree once rounded.

## Hardcoding the Simplest Possible Check
My plan has:
- peak from 07:00 to 09:00 and 17:00 to 20:00 AEDT on weekdays. Daylight savings time applies, so that is UTC+11.
- shoulder from 09:00 to 17:00 and 20:00 to 22:00 AEDT on weekdays.
- off-peak all other times.

The weekdays in the period are Jan 6-10, 13-17, 20-24, 27-31 and Feb 3-4.

NEM12 files have "300" records containing the date and energy readings and a preceding "200" record says whether the readings are consumption or feed-in. The dates are in YYYYMMDD format, so a regex to match the weekdays in the period is: `/^2025((010[6-9])|(011[0,3-7])|(012[0-4,7-9])|(013[01])|(020[34]))/`.

NEM12 always uses AEST (UTC+10)
 - the summer peak times in AEST are: 06:00 to 08:00 and 16:00 to 19:00.
 - the summer shoulder times in AEST are: 06:00 to 08:00 and 16:00 to 19:00.

My NEM12 file has a reading for every 5 min interval, in the "300" record from column 3 through to column (3 + 24 * 60/5) = 292 (end exclusive). Column 3 contains the reading for 00:00 - 00:05 AEST (UTC+10) and the next column is the reading for 00:05 - 00:10 AEST etc.

The readings for the peak times are in columns:
 - (3 + 6 * 60/5) = `75` to (3 + 8 * 60/5) = `99` (end exclusive) and
 - (3 + 16 * 60/5) = `195` to (3 + 19 * 60/5) = `231` (end exclusive).

### Implementation in awk
File redEnergyPeak.awk:
```
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
```

Run with: `awk -F, -f redEnergyBillingBug.awk EssentialEnergy_NEM12_2023-12-08_to_2025-03-29.csv`
## Result
`Peak 16.293 kWh`. Thats 1-0 for WebElec vs Red Energy.

Red Energy response 2025-05-14: _...business practice as verified by our billing department earlier today, we have advised you that we round up, I suspect you may have read this as simply rounded which is not the case._
My response 2025-05-15: _I'm sorry, but this explanation doesn't hold water because the Off-Peak value of 51.009 kWh has been rounded down to 51 and the Shoulder value of 23.376 kWh has been rounded down to 23.
Whatever it is that you are doing, it is not consistent._

