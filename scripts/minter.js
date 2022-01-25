week = 1;
const emission = 98
const tail_emission = 2
const target_base = 100
const tail_base = 1000
weekly = 20000000
totalSupply = 0



function circulating_supply() {
  return totalSupply
}

function calculate_emission() {
  return weekly * emission / target_base
}

function weekly_emission() {
  return Math.max(calculate_emission(), circulating_emission())
}

function circulating_emission() {
  return circulating_supply() * tail_emission / tail_base
}

while (week < 50) {
  weekly = weekly_emission();
  totalSupply += weekly;
  console.log("week: ",week, " minted: ", weekly," weekly: ", weekly, " totalSupply: ", totalSupply)
  week++;
}
