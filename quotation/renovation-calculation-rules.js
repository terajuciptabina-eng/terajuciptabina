/* TERAJU WORKS — Renovation Planner Calculation Rules
 * Source of truth for the Renovation Planner ruleset.
 * Intentionally separate from Build Planner V2 rules.
 * Rates remain in the Renovation Planner rate source; this file defines item/quantity logic.
 */
window.TerajuRenovationCalculationRules = [
  ["LIVING / DINING","LIVING / DINING / Plaster Ceiling","Plaster ceiling to Living / Dining area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner living/dining standard item."],
  ["LIVING / DINING","LIVING / DINING / SPC Flooring","SPC flooring to Living / Dining area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner living/dining standard item."],
  ["LIVING / DINING","LIVING / DINING / Downlight","Downlights to Living / Dining area.","AREA ALLOWANCE","1 No. / 50 sqft, minimum 4","Quantity = MAX(4, CEILING(Room Area / 50))","No.","Room Area.","Renovation Planner downlight rule."],
  ["LIVING / DINING","LIVING / DINING / Ceiling Fan","Ceiling fan to Living / Dining area.","FIXED PER ROOM","1 No. / room","Quantity = 1","No.","One fan per Living / Dining room.","Renovation Planner standard item."],
  ["LIVING / DINING","LIVING / DINING / Curtain Box LED","Curtain box LED to Living / Dining area.","FIXED PER ROOM","1 No. / room","Quantity = 1","No.","One curtain box LED allowance per room.","Renovation Planner standard item."],

  ["BEDROOM","BEDROOM / Plaster Ceiling","Plaster ceiling to Bedroom area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner bedroom standard item."],
  ["BEDROOM","BEDROOM / SPC Flooring","SPC flooring to Bedroom area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner bedroom standard item."],
  ["BEDROOM","BEDROOM / Downlight","Downlights to Bedroom area.","AREA ALLOWANCE","1 No. / 50 sqft, minimum 4","Quantity = MAX(4, CEILING(Room Area / 50))","No.","Room Area.","Renovation Planner downlight rule."],
  ["BEDROOM","BEDROOM / Ceiling Fan","Ceiling fan to Bedroom area.","FIXED PER ROOM","1 No. / room","Quantity = 1","No.","One fan per Bedroom.","Renovation Planner standard item."],
  ["BEDROOM","BEDROOM / Curtain Box LED","Curtain box LED to Bedroom area.","FIXED PER ROOM","1 No. / room","Quantity = 1","No.","One curtain box LED allowance per room.","Renovation Planner standard item."],

  ["DRY KITCHEN","DRY KITCHEN / Plaster Ceiling","Plaster ceiling to Dry Kitchen area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner dry kitchen standard item."],
  ["DRY KITCHEN","DRY KITCHEN / SPC Flooring","SPC flooring to Dry Kitchen area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner dry kitchen standard item."],
  ["DRY KITCHEN","DRY KITCHEN / Downlight","Downlights to Dry Kitchen area.","AREA ALLOWANCE","1 No. / 50 sqft, minimum 4","Quantity = MAX(4, CEILING(Room Area / 50))","No.","Room Area.","Renovation Planner downlight rule."],
  ["DRY KITCHEN","DRY KITCHEN / Bar Lamp","Bar lamp to Dry Kitchen area.","FIXED PER ROOM","1 No. / room","Quantity = 1","No.","One bar lamp allowance per Dry Kitchen.","Renovation Planner standard item."],
  ["DRY KITCHEN","DRY KITCHEN / Ceiling Fan","Ceiling fan to Dry Kitchen area.","FIXED PER ROOM","1 No. / room","Quantity = 1","No.","One fan per Dry Kitchen.","Renovation Planner standard item."],
  ["DRY KITCHEN","DRY KITCHEN / Kitchen Frame","Kitchen cabinet frame allowance.","FIXED PER ROOM","1 LS / kitchen","Quantity = 1","LS","One kitchen frame allowance.","Renovation Planner standard item."],
  ["DRY KITCHEN","DRY KITCHEN / Making Good","Kitchen making-good works.","FIXED PER ROOM","1 LS / kitchen","Quantity = 1","LS","One making-good allowance.","Renovation Planner standard item."],
  ["DRY KITCHEN","DRY KITCHEN / Swing Glass Door","Swing glass door to Dry Kitchen.","FIXED PER ROOM","1 No. / kitchen","Quantity = 1","No.","One swing glass door allowance.","Renovation Planner standard item."],

  ["WET KITCHEN","WET KITCHEN / Floor Tiles","Floor tiles to Wet Kitchen area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner wet kitchen standard item."],
  ["WET KITCHEN","WET KITCHEN / Wall Tiles","Wall tiles to Wet Kitchen area.","AREA / COEFFICIENT","2.00 sqft/sqft","Quantity = Room Area × 2","sqft","Room Area.","Existing Renovation Planner wall-tile coverage factor."],
  ["WET KITCHEN","WET KITCHEN / Plaster Ceiling","Plaster ceiling to Wet Kitchen area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner wet kitchen standard item."],
  ["WET KITCHEN","WET KITCHEN / Downlight","Downlights to Wet Kitchen area.","AREA ALLOWANCE","1 No. / 50 sqft, minimum 4","Quantity = MAX(4, CEILING(Room Area / 50))","No.","Room Area.","Renovation Planner downlight rule."],
  ["WET KITCHEN","WET KITCHEN / Ceiling Fan","Ceiling fan to Wet Kitchen area.","FIXED PER ROOM","1 No. / room","Quantity = 1","No.","One fan per Wet Kitchen.","Renovation Planner standard item."],
  ["WET KITCHEN","WET KITCHEN / Kitchen Lighting","Kitchen lighting allowance.","FIXED PER ROOM","1 LS / kitchen","Quantity = 1","LS","One kitchen lighting allowance.","Renovation Planner standard item."],

  ["BATHROOM","BATHROOM / Floor Tiles","Floor tiles to Bathroom area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner bathroom standard item."],
  ["BATHROOM","BATHROOM / Wall Tiles","Wall tiles to Bathroom area.","AREA / COEFFICIENT","6.00 sqft/sqft","Quantity = Room Area × 6","sqft","Room Area.","Existing Renovation Planner wall-tile coverage factor."],
  ["BATHROOM","BATHROOM / Plaster Ceiling","Plaster ceiling to Bathroom area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner bathroom standard item."],
  ["BATHROOM","BATHROOM / Sanitary Accessories","Bathroom sanitary accessories allowance.","FIXED PER ROOM","1 LS / bathroom","Quantity = 1","LS","One sanitary allowance per Bathroom.","Renovation Planner standard item."],
  ["BATHROOM","BATHROOM / Toilet Door","Toilet door allowance.","FIXED PER ROOM","1 No. / bathroom","Quantity = 1","No.","One toilet door per Bathroom.","Renovation Planner standard item."],
  ["BATHROOM","BATHROOM / Downlight","Downlights to Bathroom area.","AREA ALLOWANCE","1 No. / 50 sqft, minimum 4","Quantity = MAX(4, CEILING(Room Area / 50))","No.","Room Area.","Renovation Planner downlight rule."],
  ["BATHROOM","BATHROOM / Exhaust Fan","Exhaust fan to Bathroom area.","AREA ALLOWANCE","1 No. / 50 sqft, minimum 1","Quantity = MAX(1, CEILING(Room Area / 50))","No.","Room Area.","Renovation Planner exhaust-fan rule."],

  ["CAR PORCH","CAR PORCH / Floor Tiles","Floor tiles to Car Porch area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner car porch standard item."],
  ["CAR PORCH","CAR PORCH / Plaster Ceiling","Plaster ceiling to Car Porch area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Renovation Planner car porch standard item."],
  ["CAR PORCH","CAR PORCH / Downlight","Downlights to Car Porch area.","AREA ALLOWANCE","1 No. / 50 sqft, minimum 4","Quantity = MAX(4, CEILING(Room Area / 50))","No.","Room Area.","Renovation Planner downlight rule."],
  ["CAR PORCH","CAR PORCH / Gate + Motor","Gate and motor allowance to Car Porch.","FIXED PER PORCH","1 LS / porch","Quantity = 1","LS","One gate + motor allowance.","Renovation Planner standard item."],
  ["CAR PORCH","CAR PORCH / Brickwall Divider","Brickwall divider allowance to Car Porch.","FIXED PER PORCH","1 LS / porch","Quantity = 1","LS","One divider allowance.","Renovation Planner standard item."],
  ["CAR PORCH","CAR PORCH / Front Fence","Front fence allowance to Car Porch.","FIXED PER PORCH","1 LS / porch","Quantity = 1","LS","One front-fence allowance.","Renovation Planner standard item."],

  ["BALCONY","BALCONY / Floor Tiles","Floor tiles to Balcony area.","AREA","1.00 sqft/sqft","Quantity = Room Area","sqft","Room Area.","Renovation Planner balcony standard item."],
  ["BALCONY","BALCONY / Facade Wall","Facade wall works to Balcony area.","AREA / COEFFICIENT","1.33 sqft/sqft","Quantity = Room Area × 1.33","sqft","Room Area.","Existing Renovation Planner facade-wall coverage factor."],
  ["BALCONY","BALCONY / Wall Light","Wall light to Balcony area.","AREA ALLOWANCE","2 No. minimum; 1 No. / 70 sqft","Quantity = MAX(2, CEILING(Room Area / 70))","No.","Room Area.","Renovation Planner wall-light rule."],

  ["OPTIONAL WORKS","OPTIONAL WORKS / Demolition","Demolition works selected by contractor.","CUSTOM RATE / FIXED QUANTITY","1 unit / selected scope","Quantity = 1 when selected","LS","Selected optional scope.","Optional Renovation Planner item; contractor-entered rate."],
  ["OPTIONAL WORKS","OPTIONAL WORKS / Painting","Painting works selected by contractor.","CUSTOM RATE / FIXED QUANTITY","1 unit / selected scope","Quantity = 1 when selected","LS","Selected optional scope.","Optional Renovation Planner item; contractor-entered rate."],
  ["OPTIONAL WORKS","OPTIONAL WORKS / Additional Glass Door","Additional glass door.","FIXED QUANTITY","1 No. / selected item","Quantity = 1 when selected","No.","Selected optional scope.","Optional Renovation Planner item."],
  ["OPTIONAL WORKS","OPTIONAL WORKS / Additional Brickwall Divider","Additional brickwall divider.","FIXED QUANTITY","1 No. / selected item","Quantity = 1 when selected","No.","Selected optional scope.","Optional Renovation Planner item."],
  ["OPTIONAL WORKS","OPTIONAL WORKS / Additional Front Fence","Additional front fence.","FIXED QUANTITY","1 LS / selected item","Quantity = 1 when selected","LS","Selected optional scope.","Optional Renovation Planner item."],
  ["OPTIONAL WORKS","OPTIONAL WORKS / Additional Windows","Additional windows.","CUSTOM RATE / FIXED QUANTITY","1 No. / selected item","Quantity = 1 when selected","No.","Selected optional scope.","Optional Renovation Planner item; contractor-entered rate."],
  ["OPTIONAL WORKS","OPTIONAL WORKS / Additional Electrical / Wiring","Additional electrical / wiring works.","CUSTOM RATE / FIXED QUANTITY","1 LS / selected scope","Quantity = 1 when selected","LS","Selected optional scope.","Optional Renovation Planner item; contractor-entered rate."]
];