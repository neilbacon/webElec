# When WebElec and your Bill Don't Agree
I want to check the peak calculation of 17 kWh on my Red Energy bill from 05 January 2025 to 04 February 2025, because WebElec says it was 16.293 kWh. The vast majority of the numbers do agree once rounded.

## Hardcoding the Simplest Possible Check
My TOU plan has tariff bands:
- `Peak` is from 07:00 to 09:00 and 17:00 to 20:00 AEDT on weekdays. 
- `Shoulder` is from 09:00 to 17:00 and 20:00 to 22:00 AEDT on weekdays.
- `Off-peak` is all other times.

Daylight savings time applies in Jan/Feb, so AEDT is UTC+11 for this period.

The weekdays in the period are Jan 6-10, 13-17, 20-24, 27-31 and Feb 3-4.

NEM12 files have "300" records containing the date and energy readings and a preceding "200" record says whether the readings are consumption or feed-in. The dates are in YYYYMMDD format, so a regex to match the weekdays in the period is: `/^2025((010[6-9])|(011[0,3-7])|(012[0-4,7-9])|(013[01])|(020[34]))/`.

NEM12 always uses AEST (UTC+10). My summer tariff bands in AEST are:
 - `Peak` is from 06:00 to 08:00 and 16:00 to 19:00 AEST on weekdays.
 - `Shoulder` is from 08:00 to 16:00 and 19:00 to 21:00 AEST on weekdays.
 - `Off-peak` is all other times.

My NEM12 file has a reading for every 5 min interval in the "300" record. Column 3 contains the reading for 00:00 - 00:05 AEST (UTC+10) and the next column is the reading for 00:05 - 00:10 AEST etc. The start column for time hh:00 is 3 + hh * 60/5.

The readings to include for each tariff band are in columns:
 - `Peak` from 75 to 99 (end exclusive) and 195 to 231 (end exclusive) on weekdays.
 - `Shoulder` from 99 to 195 (end exclusive) and 231 to 255 (end exclusive) on weekdays.
 - `Off-peak` all other columns, that is from 3 to 75 (end exclusive) and 255 to 291 (end exclusive) on weekdays and 3 to 291 (end exclusive) on weekends.

### Implementation in awk
File `essentialEnergyNEM12.awk`:
```
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
```

Run with: `awk -F, -f essentialEnergyNEM12.awk essentialEnergyNEM12.csv`
## Result
```
Peak 16.293 kWh
Shoulder 23.376 kWh
Off-peak 51.009 kWh
```
Thats 1-0 for WebElec vs Red Energy.

## Repeat with Tabular Data Provided by Red Energy

Red Energy provided the data they use for billing as a simple table in MS Excel. I saved this as `redEnergyTabular.csv`. In this data, the 5 minute interal readings start at column 7.
### Implementation in awk
File `redEnergyTabular.awk`:
```
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
```
Run with: `awk -F, -f redEnergyTabular.awk redEnergyTabular.csv`
## Result
```
Peak 16.293 kWh
Shoulder 23.376 kWh
Off-peak 51.009 kWh
```
The same as with using NEM12 data.

## Trying to Get a Satistactory Explanation from Red Energy
Red Energy 2025-05-14:
_...business practice as verified by our billing department earlier today, we have advised you that we round up, I suspect you may have read this as simply rounded which is not the case._

Me 2025-05-15: 
_I'm sorry, but this explanation doesn't hold water because the Off-Peak value of 51.009 kWh has been rounded down to 51 and the Shoulder value of 23.376 kWh has been rounded down to 23. Whatever it is that you are doing, it is not consistent._

Red Energy 2025-05-15:
_To give you a brief explanation of the rounding, the data we receive for your account is a total of the 3 registers (peak, off-peak and shoulder) which is 90.678. This rounded becomes 91 which is the total charged._

Me 2025-05-15: 
_Please explain how this total appears in the bill calculation, because it does not appear on the bill at all.
The bill clearly shows a kWh figure and a rate for each of peak, off-peak and shoulder, the multiplication of kWh * rate and the sum of these products. Total kWh does not appear._

Red Energy 2025-05-16:
_The information provided advising that we round up is correct. We round up for the total of peak, off peak and shoulder usage._

Argh that's a full circle.

