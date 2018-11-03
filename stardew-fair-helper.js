/* stardew-fair-helper.js
 * https://mouseypounds.github.io/stardew-fair-helper/
 */

/*jslint indent: 4, maxerr: 50, passfail: false, browser: true, regexp: true, plusplus: true */
/*global $, FileReader, obj_info:true, cat_name:true, perk:true*/

window.onload = function () {
	"use strict";

	// Check for required File API support.
	if (!(window.File && window.FileReader)) {
		document.getElementById('out').innerHTML = '<span class="error">Fatal Error: Could not load the File & FileReader APIs</span>';
		return;
	}

	// Show input field immediately
	$('#input-container').show();

	// Utility functions
	function htmlDecode(s) {
		// Wladimir Palant @ https://stackoverflow.com/questions/1912501/unescape-html-entities-in-javascript
		var doc = new DOMParser().parseFromString(s, "text/html");
		return doc.documentElement.textContent;
	}
	
	function wikify(item, page) {
		// removing egg colors & changing spaces to underscores
		var trimmed = item.replace(' (White)', '');
		trimmed = trimmed.replace(' (Brown)', '');
		trimmed = trimmed.replace(/ /g, '_');
		return (page) ? ('<a href="http://stardewvalleywiki.com/' + page + '#' + trimmed + '">' + item + '</a>') :
					('<a href="http://stardewvalleywiki.com/' + trimmed + '">' + item + '</a>');
	}

	function isValidFarmhand(player) {
		// Currently using a blank userID field to determine that a farmhand slot is empty
		if ($(player).children('userID').text() === '') {
			return false;
		}
		return true;
	}

	// Object.assign() polyfill from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
	if (typeof Object.assign != 'function') {
	// Must be writable: true, enumerable: false, configurable: true
		Object.defineProperty(Object, "assign", {
			value: function assign(target, varArgs) { // .length of function is 2
				if (target === null) { // TypeError if undefined or null
					throw new TypeError('Cannot convert undefined or null to object');
				}

			var to = Object(target);

			for (var index = 1; index < arguments.length; index++) {
				var nextSource = arguments[index];

				if (nextSource !== null) { // Skip over if undefined or null
					for (var nextKey in nextSource) {
						// Avoid bugs when hasOwnProperty is shadowed
						if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
							to[nextKey] = nextSource[nextKey];
						}
					}
				}
			}
			return to;
			},
			writable: true,
			configurable: true
		});
	}
	
	function printObject(o) {
		var r = '<div class="objdump">';
		for (var p in o) {
			r += p + ': ' + o[p] + ', ';
		}
		r += '</div>';
		return r;
	}
	
	// Save parsing will set all the form fields and then refresh the calculation when done.
	function parseFile(xmlDoc) {
		var max_cat = [],
			extra = [],
			container,
			loc,
			blank_item = { id:'none', name:'(No Item)', price:0, qual:0, stack: 0, pts: 0,
							fair_cat:8, real_cat:0, sort_bonus:false, loc:'(Location info if analyzing a save)' },
			cat_translate = { "-18": 0, "-14": 0, "-6": 0, "-5": 0, "-26": 1, "-7": 2, "-4": 3,
							  "-81": 4, "-80": 4, "-27": 4, "-79": 5, "-12": 6, "-2": 6, "-75": 7 },
			professions = { 0: "Rancher", 1: "Tiller", 4: "Artisan", 6: "Fisher", 8: "Angler",
							12: "Forester", 15: "Tapper", 20: "Blacksmith", 23: "Gemologist" },
			events = { 2120303: "BearsKnowledge", 3910979: "SpringOnionMastery" },
			packedColor = {
				4278190080: "Brown",
				4294923605: "Dark Blue",
				4294950775: "Light Blue",
				4289374720: "Dark Blue-Green",
				4289718784: "Light Blue-Green",
				4278233600: "Dark Green",
				4278250655: "Light Green",
				4279429887: "Yellow",
				4279412735: "Yellow-Orange",
				4279396863: "Orange",
				4278190335: "Red", 
				4280483975: "Dark Red",
				4291276287: "Pale Pink",
				4290999807: "Bright Pink",
				4291166380: "Magenta",
				4294901903: "Purple",
				4287499097: "Dark Purple",
				4282400832: "Black",
				4284769380: "Dark Grey",
				4291348680: "Light Grey",
				4294901502: "White",
				},
			i,
			n;

		// Debug output; delete later
		var out = "<h3>Debug Output</h3>";		
			
		// Defining helper functions here in order to have access to our object arrays, particularly the jQuery each handler.	
		function byPoints(a, b) {
			// sort helper function
			return b.pts - a.pts || b.price - a.price;
		}

		function sortItem(o) {
			// Item sorting looks to replace the max for this category first
			// Then merges the loser of that comparison into the extras
			var loser = Object.assign({}, o);
			if (o.fair_cat !== 8) {
				if (o.pts > max_cat[o.fair_cat].pts) {
					loser = Object.assign({}, max_cat[o.fair_cat]);
					Object.assign(max_cat[o.fair_cat], o);
				} else {
				}
			}
			for (var j = 0; j < 9; j++) {
				if (loser.pts > extra[j].pts) {
					extra.splice(j, 0, loser);
					extra.pop();
					if (loser.stack > 1) {
						loser.stack--;
						continue;
					} else {
						break;
					}
				}
			}
		}
		
		function parseObject(index, e) {
			// the .each() handler
			var o = Object.assign({}, blank_item);
			o.name = $(e).find('name').html();
			o.price = Number($(e).find('price').text());
			o.id = Number($(e).find('parentSheetIndex').text());
			o.real_cat = Number($(e).find('category').text());
			if (cat_translate.hasOwnProperty(o.real_cat)) { o.fair_cat = cat_translate[o.real_cat]; }
			o.qual = Number($(e).find('quality').text());
			o.stack = Number($(e).find('Stack').text());
			o.loc = loc;
			o.pts = calculateItemScore(o);
			sortItem(o);
			out += printObject(o);
		}		

		// Perks & Events
		// First clear any manually-entered values.
		for (i in perk) {
			if (i === "DifficultyModifier") {
				perk[i] = 1;
			} else {
				perk[i] = false;
			}
		}
		$("#profit_margin").val("0.00");
		$('input.perk').prop('checked', false);
			
		// Now set perks based on save; all farmhands are counted
		n = Number($(xmlDoc).find('difficultyModifier').text());
		if (typeof(n) === 'undefined' || n === 0) {
			n = 1;
		}
		perk.DifficultyModifier = n;
		$("#profit_margin").val(n.toFixed(2));
		
		$(xmlDoc).find('professions > int').each(function() {
			n = Number($(this).text());
			if (!perk[professions[n]]) {
				perk[professions[n]] = true;
				$('input[name="perk_'+n+'"]').prop('checked', true);
			}
		});

		$(xmlDoc).find('eventsSeen > int').each(function() {
			n = Number($(this).text());
			if (n === 2120303 || n === 3910979) {
				if (!perk[events[n]]) {
					perk[events[n]] = true;
					$('input[name="event_'+n+'"]').prop('checked', true);
				}
			}
		});
		
		// Item Search
		// Initialize max value item for each category & the top 9 "extras"
		for (i = 0; i < 8 ; i++) {
			max_cat[i] = Object.assign({}, blank_item);
		}
		for (i = 0; i < 10 ; i++) {
			extra[i] = Object.assign({}, blank_item);
		}

		// Main player inventory
		container = $(xmlDoc).find('player');
		loc = $(container).find('name').html() + "'s Inventory";
		out += "<h4>" + loc + "</h4>";
		$(container).find("Item[xsi\\:type='Object']").each(parseObject);
		
		// Farmhand inventories
		$(xmlDoc).find('farmhand').each(function() {
			if (isValidFarmhand(this)) {
				container = this;
				loc = $(container).find('name').html() + "'s Inventory";
				out += "<h4>" + loc + "</h4>";
				$(container).find("Item[xsi\\:type='Object']").each(parseObject);	
			}
		});
		
		// Chests and other storage
		$(xmlDoc).find('playerChest').each(function() {
			var locName = $(this).parents("GameLocation").children("name").html(),
				bldgName = $(this).parents("Building").children("buildingType").html();
			if ($(this).text() === "true" || $(this).parent().prop("tagName") === 'heldObject') {
				var name,
					color;
				if (typeof(locName) === "undefined") {
					locName = "";
				} else {
					locName = " in " + locName;
				}
				if (typeof(bldgName) === "undefined") {
					bldgName = "";
				} else {
					bldgName = " in " + bldgName;
				}
				container = $(this).parent();
				if ($(container).prop("tagName") === 'fridge') {
					name = "Fridge";
				} else if ($(container).parent().find("name").html() === "Auto-Grabber") {
					name = "Auto-Grabber";
				} else if ($(this).prop("tagName") === 'output') {
					name = "Output Bin";
				} else {
					name = $(container).find("name").html();
					if (name !== "Chest") {
						// Named chest, probably from a mod
						// Ignore if a CFR machine
						if (name.match(/^PyTK\|Item\|CustomFarmingRedux/)) {
							return true;
						}
						// Remove Chests Anywhere special flags
						name = name.replace(/\s+\|.+\|/,'');
						name = "Chest (" + name + ")";
					}
					color = $(container).find('playerChoiceColor PackedValue').text();
					if (packedColor.hasOwnProperty(color)) {
						name = packedColor[color] + " " + name;
					}	
				}
				loc = name + bldgName + locName;
				out += "<h4>" + loc + "</h4>";
				$(container).find("Item[xsi\\:type='Object']").each(parseObject);
			}
		});

		// Now we choose the best object combination by adding 5 bonus pts to the highest 6 category maxima
		// and then merging with the extras to pick the best 9 items overall.
		max_cat.sort(byPoints);
		for (i = 0; i < 6; i++) {
			if (max_cat[i].id !== 'none') {
				max_cat[i].pts += 5;
				max_cat[i].sort_bonus = true;
			}
		}
		Array.prototype.push.apply(extra, max_cat);
		extra.sort(byPoints);
		for (i = 0; i < 9; i++) {
			$('#item_' + (i+1) + '_qual').val(extra[i].qual).trigger('change.select2');
			$('#item_' + (i+1) + '_name').val(extra[i].id).trigger('change.select2');
			$('#item_' + (i+1) + '_pts').val(((extra[i].sort_bonus) ? extra[i].pts - 5 : extra[i].pts) + " pts");
			$('#item_' + (i+1) + '_cat').val(cat_name[extra[i].fair_cat]);
			$('#item_' + (i+1) + '_loc').val(htmlDecode(extra[i].loc));
		}
		calculateScore(false);

		//$("#debug").html(out);
	}

	function handleFileSelect(evt) {
		var file = evt.target.files[0],
			reader = new FileReader(),
			prog = document.getElementById('progress');

		prog.value = 0;
		//$('#output-container').hide();
		$('#progress-container').show();
		//$('#changelog').hide();
		reader.onloadstart = function () {
			prog.value = 20;
		};
		reader.onprogress = function (e) {
			if (e.lengthComputable) {
				var p = 20 + (e.loaded / e.total * 60);
				prog.value = p;
			}
		};
		reader.onload = function (e) {
			var xmlDoc = $.parseXML(e.target.result);

			parseFile(xmlDoc);
			prog.value = 100;
			$('#output-container').show();
			$('#progress-container').hide();
		};
		reader.readAsText(file);
	}
	document.getElementById('file_select').addEventListener('change', handleFileSelect, false);

	function toggleVisible(evt) {
		var t = evt.target;
		if ($(t).next().is(':visible')) {
			$(t).next().hide();
			$(t).html("Show");
		} else {
			$(t).next().show();
			$(t).html("Hide");
		}
	}
	
	function adjustPrice(id, basePrice, category, quality) {
		// Price adjustments from StardewValley.Object.sellToStorePrice()
		var multiplier = 1.0,
			price = Math.floor(basePrice * (1 + quality*0.25));
			id = Number(id);
		if (perk.Rancher) {
			// Using id check instead of name check for artisan animal goods
			if (category === -5 || category === -6 || category === -18 ||
				id === 306 || id === 307 ||  id === 308 ||  id === 424 ||  id === 426 ||  id === 428 ||  id === 440) {
				multiplier *= 1.2;
			}
		}
		if (perk.Tiller) {
			// Using hardcoded id check for spawned item test; this is not 100% accurate since it is set per-object in the game
			if (category === -75 || category === -79 || category === -80 &&
				id !== 259 && id !== 88 &&  id !== 90 &&  id !== 296 &&  id !== 396 &&  id !== 406 &&  id === 410 &&  id === 414) {
				multiplier *= 1.1;
			}
		}
		if (perk.Artisan && category === -26){
			multiplier *= 1.4;
		}
		// In the base game Angler is only checked if Fisher is also present so we do the same
		if (perk.Fisher && category === -4){
			multiplier *= (perk.Angler ? 1.5: 1.25);
		}
		if (perk.Forester && (id === 388 || id === 709)){
			multiplier *= 1.5;
		}
		if (perk.Tapper && category === -27){
			multiplier *= 1.25;
		}
		if (perk.Blacksmith && id >= 334 && id <= 337){
			multiplier *= 1.5;
		}
		if (perk.Gemologist && (category === -2 || category === -12)){
			multiplier *= 1.3;
		}
		if (perk.BearsKnowledge && (id === 296 || id === 410)){
			multiplier *= 3;
		}
		if (perk.SpringOnionMastery && id === 399){
			multiplier *= 5;
		}
		price *= multiplier;
		if (id === 493) { price /= 2.0; } // Hardcoded Cranberry Seed price nerf
		if (price > 0) {
			price = Math.max(1, price * Number(perk.DifficultyModifier));
		}
		return Math.floor(price);
	}
	
	function refreshPerks(evt) {
		var t = evt.target;
		perk[$(t).val()] = $(t).prop('checked');
		// Enforcing prereqs
		if ($(t).val() === 'Fisher' && $(t).prop('checked') === false) {
			$('input[name="perk_8"]').prop('checked', false);
			perk.Angler = false;
		} else if ($(t).val() === 'Angler' && $(t).prop('checked') === true) {
			$('input[name="perk_6"]').prop('checked', true);
			perk.Fisher = true;
		} else if  ($(t).val() === 'Forester' && $(t).prop('checked') === false) {
			$('input[name="perk_15"]').prop('checked', false);
			perk.Tapper = false;
		} else if  ($(t).val() === 'Tapper' && $(t).prop('checked') === true) {
			$('input[name="perk_12"]').prop('checked', true);
			perk.Forester = true;
		} else if  ($(t).val() === 'Tiller' && $(t).prop('checked') === false) {
			$('input[name="perk_4"]').prop('checked', false);
			perk.Artisan = false;
		} else if  ($(t).val() === 'Artisan' && $(t).prop('checked') === true) {
			$('input[name="perk_1"]').prop('checked', true);
			perk.Tiller = true;
		} 
		calculateScore(true);
	}

	function changeProfitMargin(evt) {
		var t = evt.target;
		var n = Number($(t).val());
		if (n < 0) {
			n = 0;
		} else if (n > 1) {
			n = 1;
		}
		perk.DifficultyModifier = n;
		$(t).val(n.toFixed(2));
		calculateScore(true);
	}

	function refreshItem(evt) {
		var t = evt.target,
			re = /^item_(\d+)_/,
			n = re.exec($(t).attr('id'));
		if (typeof(n) !== "undefined") {
			var sid = $("#item_" + n[1] + "_name").val(),
				qual = Number($("#item_" + n[1] + "_qual").val()),
				pts = 0,
				fair_cat = 8;
			if (sid === 'none') {
				// No item, so reset category, points & location
				$("#item_" + n[1] + "_cat").val("(No Category)");
				$("#item_" + n[1] + "_pts").val("0 pts");
				$("#item_" + n[1] + "_loc").val("(Location info if analyzing a save)");
			} else {
				if (obj_info.hasOwnProperty(sid)) {
					fair_cat = obj_info[sid].fair_cat;
				}
				$("#item_" + n[1] + "_cat").val(cat_name[fair_cat]);
				pts = calculateItemScore({ 'id': sid, 'price': obj_info[sid].price, 'real_cat': obj_info[sid].real_cat, 'qual': qual });
				$("#item_" + n[1] + "_pts").val(pts + " pts");
				$("#item_" + n[1] + "_loc").val("(Manual item selection)");
			}
		}
		calculateScore(false);
	}

	function calculateItemScore(o) {
		// Primary logic from StardewValley.Event.lewisDoneJudgingGrange()
		var this_score = o.qual + 1,
			price = adjustPrice(o.id, o.price, o.real_cat, o.qual);
		if (price >= 20) { this_score++; }
		if (price >= 90) { this_score++; }
		if (price >= 200) { this_score++; }
		if (price >= 300 && o.qual < 2) { this_score++; }
		if (price >= 400 && o.qual < 1) { this_score++; }
		return this_score;
	}
	
	function calculateScore(forceItemScores) {
		var summary,
			score = 14,
			blanks = 0,
			score_num = 0,
			cat_seen = {},
			num_cat = 0,
			score_cat = 0,
			qual_name = ["No Star", "Silver", "Gold", "", "Iridium"],
			output = '<table class="output"><thead><tr><th class="details" colspan="2">Scoring Details</th><th class="score">Points</th></thead><tbody>';
		for (var i = 1; i < 10; i++) {
			var this_score = 0,
				qual = Number($("#item_"+i+"_qual").val()),
				sid = $("#item_"+i+"_name").val(),
				cat = 8,
				price = 0,
				real_cat = 0;
			if (sid === 'none') {
				blanks++;
				output += '<tr><td>' + 'Item ' + i + '</td><td> (No Item) </td><td>0</td></tr>';
			} else {
				if (obj_info.hasOwnProperty(sid)) {
					cat = obj_info[sid].fair_cat;
					price = obj_info[sid].price;
					real_cat = obj_info[sid].real_cat;
				}
				if (cat !== 8) {
					cat_seen[cat] = 1;
				}
				if (forceItemScores) {
					$("#item_"+i+"_pts").val(calculateItemScore({ 'id': sid, 'price': price, 'real_cat': real_cat, 'qual': qual }) + " pts");
				}
				var re = /^(\d+) /,
					n = re.exec($("#item_"+i+"_pts").val());
				if (typeof(n) !== "undefined") {
					this_score = Number(n[1]);
				}
				output += '<tr><td>' + 'Item ' + i + '</td><td>' + wikify(obj_info[sid].name) + ' (' + qual_name[qual] + ')' + '</td><td>' + this_score + '</td></tr>';
				score += this_score;
			}
			
		}
		score_num = (9 - 2 * blanks);
		output += '<tr><td colspan="2">Number of items (' + (9 - blanks) + '/9)</td><td>' + score_num + '</td></tr>';
		score += score_num;
		num_cat = Object.keys(cat_seen).length;
		score_cat = Math.min(30, num_cat * 5);
		output += '<tr><td colspan="2">Number of categories (' + num_cat + '/6)</td><td>' + score_cat + '</td></tr>';
		score += score_cat;
		output += '<tr><td colspan="2">Free points</td><td>14</td></tr>';
		output += '<tr><th class="total" colspan="2">Total</th><th class="total">' + score + '</th></tr>';
		output += "</thead></table>";
		summary = '<p>This display will earn <span class="pts">' + score + " points</span>, which is enough for ";
		if (score >= 90) {
			summary += ' <span class="pts">first place</span> and <span class="pts">1000 star tokens</span>!';
		} else if (score >= 75) {
			summary += ' <span class="pts">second place</span> and <span class="pts">500 star tokens</span>. ' +
				(90-score) + ' more points are needed to get first place.' ;
		} else if (score >= 60) {
			summary += ' <span class="pts">third place</span> and <span class="pts">200 star tokens</span>. ' +
				(75-score) + ' more points are needed for second place, and ' +
				(90-score) + ' more points are needed to get first place.' ;
		} else {
			summary += ' <span class="pts">fourth place</span> and <span class="pts">50 star tokens.</span> ' +
				(60-score) + ' more points are needed for third place, ' + 
				(75-score) + ' more points are needed for second place, and ' +
				(90-score) + ' more points are needed to get first place.' ;
		}
		summary += "</p>";
		
		$("#score_summary").html(summary);
		$("#score_summary").append(output).show();
	}
	
	$( document ).ready(function() {
		var container = ('#item_entry');
		$(container).append('<h3 class="form_header">Items</h3>');
		
		for (var i = 1; i < 10; i++ ) {
			var stuff = '<fieldset id="item_' + i + 'set"><legend>Item ' + i + '</legend>';
			stuff += '<select class="quality" id="item_' + i + '_qual"></select>';
			stuff += ' <select class="item" id="item_' + i + '_name"></select>';
			stuff += ' <input type="text" class="category" id="item_' + i + '_cat" value="(No Category)">';
			stuff += ' <input type="text" class="item_pts" id="item_' + i + '_pts" value="0 pts">';
			stuff += ' <input type="text" class="location" id="item_' + i + '_loc" value="(Location info if analyzing a save)"></fieldset>';
			$(container).append(stuff);
		}
		
		var data = [
			{ id: 'none', text: '(No Item)' },
			{ id: 'cat_0', text: 'Animal Prod.', children: [
				{ id: 442, text:'Duck Egg' },
				{ id: 444, text:'Duck Feather' },
				{ id: 180, text:'Egg (Brown)' },
				{ id: 176, text:'Egg (White)' },
				{ id: 436, text:'Goat Milk' },
				{ id: 438, text:'L. Goat Milk' },
				{ id: 182, text:'Large Egg (Brown)' },
				{ id: 174, text:'Large Egg (White)' },
				{ id: 186, text:'Large Milk' },
				{ id: 184, text:'Milk' },
				{ id: 446, text:'Rabbit\'s Foot' },
				{ id: 305, text:'Void Egg' },
				{ id: 440, text:'Wool' },
			]},
			{ id: 'cat_1', text: 'Artisan Goods', children: [
				{ id: "350_300", text:'Amaranth Juice' },
				{ id: "344_454", text:'Ancient Fruit Jelly' },
				{ id: "348_454", text:'Ancient Fruit Wine' },
				{ id: "344_613", text:'Apple Jelly' },
				{ id: "348_613", text:'Apple Wine' },
				{ id: "344_634", text:'Apricot Jelly' },
				{ id: "348_634", text:'Apricot Wine' },
				{ id: "350_274", text:'Artichoke Juice' },
				{ id: 346, text:'Beer' },
				{ id: "350_284", text:'Beet Juice' },
				{ id: "344_410", text:'Blackberry Jelly' },
				{ id: "348_410", text:'Blackberry Wine' },
				{ id: "340_597", text:'Blue Jazz Honey' },
				{ id: "344_258", text:'Blueberry Jelly' },
				{ id: "348_258", text:'Blueberry Wine' },
				{ id: "350_278", text:'Bok Choy Juice' },
				{ id: "344_90", text:'Cactus Fruit Jelly' },
				{ id: "348_90", text:'Cactus Fruit Wine' },
				{ id: "350_190", text:'Cauliflower Juice' },
				{ id: 424, text:'Cheese' },
				{ id: "344_638", text:'Cherry Jelly' },
				{ id: "348_638", text:'Cherry Wine' },
				{ id: 428, text:'Cloth' },
				{ id: "344_88", text:'Coconut Jelly' },
				{ id: "348_88", text:'Coconut Wine' },
				{ id: "350_270", text:'Corn Juice' },
				{ id: "344_282", text:'Cranberries Jelly' },
				{ id: "348_282", text:'Cranberries Wine' },
				{ id: "344_414", text:'Crystal Fruit Jelly' },
				{ id: "348_414", text:'Crystal Fruit Wine' },
				{ id: 307, text:'Duck Mayonnaise' },
				{ id: "350_272", text:'Eggplant Juice' },
				{ id: "340_595", text:'Fairy Rose Honey' },
				{ id: "350_259", text:'Fiddlehead Fern Juice' },
				{ id: "350_248", text:'Garlic Juice' },
				{ id: 426, text:'Goat Cheese' },
				{ id: "344_398", text:'Grape Jelly' },
				{ id: "348_398", text:'Grape Wine' },
				{ id: "350_188", text:'Green Bean Juice' },
				{ id: "344_260", text:'Hot Pepper Jelly' },
				{ id: "348_260", text:'Hot Pepper Wine' },
				{ id: 344, text:'Jelly (Generic)' },
				{ id: 350, text:'Juice (Generic)' },
				{ id: "350_250", text:'Kale Juice' },
				{ id: 306, text:'Mayonnaise' },
				{ id: 459, text:'Mead' },
				{ id: "344_254", text:'Melon Jelly' },
				{ id: "348_254", text:'Melon Wine' },
				{ id: "344_635", text:'Orange Jelly' },
				{ id: "348_635", text:'Orange Wine' },
				{ id: 303, text:'Pale Ale' },
				{ id: "350_24", text:'Parsnip Juice' },
				{ id: "344_636", text:'Peach Jelly' },
				{ id: "348_636", text:'Peach Wine' },
				{ id: "342_300", text:'Pickled Amaranth' },
				{ id: "342_274", text:'Pickled Artichoke' },
				{ id: "342_284", text:'Pickled Beet' },
				{ id: "342_278", text:'Pickled Bok Choy' },
				{ id: "342_190", text:'Pickled Cauliflower' },
				{ id: "342_270", text:'Pickled Corn' },
				{ id: "342_272", text:'Pickled Eggplant' },
				{ id: "342_259", text:'Pickled Fiddlehead Fern' },
				{ id: "342_248", text:'Pickled Garlic' },
				{ id: "342_188", text:'Pickled Green Bean' },
				{ id: "342_304", text:'Pickled Hops' },
				{ id: "342_250", text:'Pickled Kale' },
				{ id: "342_24", text:'Pickled Parsnip' },
				{ id: "342_192", text:'Pickled Potato' },
				{ id: "342_276", text:'Pickled Pumpkin' },
				{ id: "342_264", text:'Pickled Radish' },
				{ id: "342_266", text:'Pickled Red Cabbage' },
				{ id: "342_256", text:'Pickled Tomato' },
				{ id: "342_262", text:'Pickled Wheat' },
				{ id: "342_280", text:'Pickled Yam' },
				{ id: 342, text:'Pickles (Generic)' },
				{ id: "344_637", text:'Pomegranate Jelly' },
				{ id: "348_637", text:'Pomegranate Wine' },
				{ id: "340_376", text:'Poppy Honey' },
				{ id: "350_192", text:'Potato Juice' },
				{ id: "350_276", text:'Pumpkin Juice' },
				{ id: "350_264", text:'Radish Juice' },
				{ id: "350_266", text:'Red Cabbage Juice' },
				{ id: "344_252", text:'Rhubarb Jelly' },
				{ id: "348_252", text:'Rhubarb Wine' },
				{ id: "344_296", text:'Salmonberry Jelly' },
				{ id: "348_296", text:'Salmonberry Wine' },
				{ id: "344_396", text:'Spice Berry Jelly' },
				{ id: "348_396", text:'Spice Berry Wine' },
				{ id: "344_268", text:'Starfruit Jelly' },
				{ id: "348_268", text:'Starfruit Wine' },
				{ id: "344_400", text:'Strawberry Jelly' },
				{ id: "348_400", text:'Strawberry Wine' },
				{ id: "340_593", text:'Summer Spangle Honey' },
				{ id: "350_256", text:'Tomato Juice' },
				{ id: 432, text:'Truffle Oil' },
				{ id: "340_591", text:'Tulip Honey' },
				{ id: 308, text:'Void Mayonnaise' },
				{ id: 340, text:'Wild Honey' },
				{ id: "344_406", text:'Wild Plum Jelly' },
				{ id: "348_406", text:'Wild Plum Wine' },
				{ id: 348, text:'Wine (Generic)' },
				{ id: "350_280", text:'Yam Juice' },
			]},
			{ id: 'cat_2', text: 'Cooked Items', children: [
				{ id: 456, text:'Algae Soup' },
				{ id: 605, text:'Artichoke Dip' },
				{ id: 235, text:'Autumn\'s Bounty' },
				{ id: 198, text:'Baked Fish' },
				{ id: 207, text:'Bean Hotpot' },
				{ id: 611, text:'Blackberry Cobbler' },
				{ id: 234, text:'Blueberry Tart' },
				{ id: 216, text:'Bread' },
				{ id: 618, text:'Bruschetta' },
				{ id: 209, text:'Carp Surprise' },
				{ id: 197, text:'Cheese Cauliflower' },
				{ id: 220, text:'Chocolate Cake' },
				{ id: 727, text:'Chowder' },
				{ id: 648, text:'Coleslaw' },
				{ id: 201, text:'Complete Breakfast' },
				{ id: 223, text:'Cookie' },
				{ id: 732, text:'Crab Cakes' },
				{ id: 612, text:'Cranberry Candy' },
				{ id: 238, text:'Cranberry Sauce' },
				{ id: 214, text:'Crispy Bass' },
				{ id: 242, text:'Dish O\' The Sea' },
				{ id: 231, text:'Eggplant Parmesan' },
				{ id: 729, text:'Escargot' },
				{ id: 240, text:'Farmer\'s Lunch' },
				{ id: 649, text:'Fiddlehead Risotto' },
				{ id: 728, text:'Fish Stew' },
				{ id: 213, text:'Fish Taco' },
				{ id: 202, text:'Fried Calamari' },
				{ id: 225, text:'Fried Eel' },
				{ id: 194, text:'Fried Egg' },
				{ id: 205, text:'Fried Mushroom' },
				{ id: 610, text:'Fruit Salad' },
				{ id: 208, text:'Glazed Yams' },
				{ id: 210, text:'Hashbrowns' },
				{ id: 233, text:'Ice Cream' },
				{ id: 773, text:'Life Elixir' },
				{ id: 730, text:'Lobster Bisque' },
				{ id: 204, text:'Lucky Lunch' },
				{ id: 228, text:'Maki Roll' },
				{ id: 731, text:'Maple Bar' },
				{ id: 243, text:'Miner\'s Treat' },
				{ id: 772, text:'Oil of Garlic' },
				{ id: 195, text:'Omelet' },
				{ id: 457, text:'Pale Broth' },
				{ id: 211, text:'Pancakes' },
				{ id: 199, text:'Parsnip Soup' },
				{ id: 215, text:'Pepper Poppers' },
				{ id: 221, text:'Pink Cake' },
				{ id: 206, text:'Pizza' },
				{ id: 604, text:'Plum Pudding' },
				{ id: 651, text:'Poppyseed Muffin' },
				{ id: 608, text:'Pumpkin Pie' },
				{ id: 236, text:'Pumpkin Soup' },
				{ id: 609, text:'Radish Salad' },
				{ id: 230, text:'Red Plate' },
				{ id: 222, text:'Rhubarb Pie' },
				{ id: 232, text:'Rice Pudding' },
				{ id: 607, text:'Roasted Hazelnuts' },
				{ id: 244, text:'Roots Platter' },
				{ id: 196, text:'Salad' },
				{ id: 212, text:'Salmon Dinner' },
				{ id: 227, text:'Sashimi' },
				{ id: 224, text:'Spaghetti' },
				{ id: 226, text:'Spicy Eel' },
				{ id: 606, text:'Stir Fry' },
				{ id: 203, text:'Strange Bun' },
				{ id: 239, text:'Stuffing' },
				{ id: 237, text:'Super Meal' },
				{ id: 241, text:'Survival Burger' },
				{ id: 218, text:'Tom Kha Soup' },
				{ id: 229, text:'Tortilla' },
				{ id: 219, text:'Trout Soup' },
				{ id: 200, text:'Vegetable Medley' },
			]},
			{ id: 'cat_3', text: 'Fish', children: [
				{ id: 705, text:'Albacore' },
				{ id: 129, text:'Anchovy' },
				{ id: 160, text:'Angler' },
				{ id: 800, text:'Blobfish' },
				{ id: 132, text:'Bream' },
				{ id: 700, text:'Bullhead' },
				{ id: 142, text:'Carp' },
				{ id: 143, text:'Catfish' },
				{ id: 702, text:'Chub' },
				{ id: 718, text:'Cockle' },
				{ id: 717, text:'Crab' },
				{ id: 716, text:'Crayfish' },
				{ id: 159, text:'Crimsonfish' },
				{ id: 704, text:'Dorado' },
				{ id: 148, text:'Eel' },
				{ id: 156, text:'Ghostfish' },
				{ id: 775, text:'Glacierfish' },
				{ id: 708, text:'Halibut' },
				{ id: 147, text:'Herring' },
				{ id: 161, text:'Ice Pip' },
				{ id: 136, text:'Largemouth Bass' },
				{ id: 162, text:'Lava Eel' },
				{ id: 163, text:'Legend' },
				{ id: 707, text:'Lingcod' },
				{ id: 715, text:'Lobster' },
				{ id: 798, text:'Midnight Squid' },
				{ id: 719, text:'Mussel' },
				{ id: 682, text:'Mutant Carp' },
				{ id: 149, text:'Octopus' },
				{ id: 723, text:'Oyster' },
				{ id: 141, text:'Perch' },
				{ id: 722, text:'Periwinkle' },
				{ id: 144, text:'Pike' },
				{ id: 128, text:'Pufferfish' },
				{ id: 138, text:'Rainbow Trout' },
				{ id: 146, text:'Red Mullet' },
				{ id: 150, text:'Red Snapper' },
				{ id: 139, text:'Salmon' },
				{ id: 164, text:'Sandfish' },
				{ id: 131, text:'Sardine' },
				{ id: 165, text:'Scorpion Carp' },
				{ id: 154, text:'Sea Cucumber' },
				{ id: 706, text:'Shad' },
				{ id: 720, text:'Shrimp' },
				{ id: 796, text:'Slimejack' },
				{ id: 137, text:'Smallmouth Bass' },
				{ id: 721, text:'Snail' },
				{ id: 799, text:'Spook Fish' },
				{ id: 151, text:'Squid' },
				{ id: 158, text:'Stonefish' },
				{ id: 698, text:'Sturgeon' },
				{ id: 145, text:'Sunfish' },
				{ id: 155, text:'Super Cucumber' },
				{ id: 699, text:'Tiger Trout' },
				{ id: 701, text:'Tilapia' },
				{ id: 130, text:'Tuna' },
				{ id: 795, text:'Void Salmon' },
				{ id: 140, text:'Walleye' },
				{ id: 734, text:'Woodskip' },
			]},
			{ id: 'cat_4', text: 'Forage/Flowers', children: [
				{ id: 597, text:'Blue Jazz' },
				{ id: 78, text:'Cave Carrot' },
				{ id: 281, text:'Chanterelle' },
				{ id: 404, text:'Common Mushroom' },
				{ id: 418, text:'Crocus' },
				{ id: 18, text:'Daffodil' },
				{ id: 22, text:'Dandelion' },
				{ id: 595, text:'Fairy Rose' },
				{ id: 408, text:'Hazelnut' },
				{ id: 283, text:'Holly' },
				{ id: 20, text:'Leek' },
				{ id: 724, text:'Maple Syrup' },
				{ id: 257, text:'Morel' },
				{ id: 725, text:'Oak Resin' },
				{ id: 726, text:'Pine Tar' },
				{ id: 376, text:'Poppy' },
				{ id: 422, text:'Purple Mushroom' },
				{ id: 420, text:'Red Mushroom' },
				{ id: 92, text:'Sap' },
				{ id: 416, text:'Snow Yam' },
				{ id: 399, text:'Spring Onion' },
				{ id: 593, text:'Summer Spangle' },
				{ id: 421, text:'Sunflower' },
				{ id: 402, text:'Sweet Pea' },
				{ id: 591, text:'Tulip' },
				{ id: 16, text:'Wild Horseradish' },
				{ id: 412, text:'Winter Root' },
			]},
			{ id: 'cat_5', text: 'Fruits', children: [
				{ id: 454, text:'Ancient Fruit' },
				{ id: 613, text:'Apple' },
				{ id: 634, text:'Apricot' },
				{ id: 410, text:'Blackberry' },
				{ id: 258, text:'Blueberry' },
				{ id: 90, text:'Cactus Fruit' },
				{ id: 638, text:'Cherry' },
				{ id: 88, text:'Coconut' },
				{ id: 282, text:'Cranberries' },
				{ id: 414, text:'Crystal Fruit' },
				{ id: 398, text:'Grape' },
				{ id: 260, text:'Hot Pepper' },
				{ id: 254, text:'Melon' },
				{ id: 635, text:'Orange' },
				{ id: 636, text:'Peach' },
				{ id: 637, text:'Pomegranate' },
				{ id: 252, text:'Rhubarb' },
				{ id: 296, text:'Salmonberry' },
				{ id: 396, text:'Spice Berry' },
				{ id: 268, text:'Starfruit' },
				{ id: 400, text:'Strawberry' },
				{ id: 406, text:'Wild Plum' },
			]},
			{ id: 'cat_6', text: 'Gems/Minerals', children: [
				{ id: 541, text:'Aerinite' },
				{ id: 538, text:'Alamite' },
				{ id: 66, text:'Amethyst' },
				{ id: 62, text:'Aquamarine' },
				{ id: 540, text:'Baryte' },
				{ id: 570, text:'Basalt' },
				{ id: 539, text:'Bixite' },
				{ id: 542, text:'Calcite' },
				{ id: 566, text:'Celestine' },
				{ id: 72, text:'Diamond' },
				{ id: 543, text:'Dolomite' },
				{ id: 86, text:'Earth Crystal' },
				{ id: 60, text:'Emerald' },
				{ id: 544, text:'Esperite' },
				{ id: 577, text:'Fairy Stone' },
				{ id: 565, text:'Fire Opal' },
				{ id: 82, text:'Fire Quartz' },
				{ id: 545, text:'Fluorapatite' },
				{ id: 84, text:'Frozen Tear' },
				{ id: 546, text:'Geminite' },
				{ id: 561, text:'Ghost Crystal' },
				{ id: 569, text:'Granite' },
				{ id: 547, text:'Helvite' },
				{ id: 573, text:'Hematite' },
				{ id: 70, text:'Jade' },
				{ id: 549, text:'Jagoite' },
				{ id: 548, text:'Jamborite' },
				{ id: 563, text:'Jasper' },
				{ id: 550, text:'Kyanite' },
				{ id: 554, text:'Lemon Stone' },
				{ id: 571, text:'Limestone' },
				{ id: 551, text:'Lunarite' },
				{ id: 552, text:'Malachite' },
				{ id: 567, text:'Marble' },
				{ id: 574, text:'Mudstone' },
				{ id: 555, text:'Nekoite' },
				{ id: 553, text:'Neptunite' },
				{ id: 575, text:'Obsidian' },
				{ id: 560, text:'Ocean Stone' },
				{ id: 564, text:'Opal' },
				{ id: 556, text:'Orpiment' },
				{ id: 557, text:'Petrified Slime' },
				{ id: 74, text:'Prismatic Shard' },
				{ id: 559, text:'Pyrite' },
				{ id: 80, text:'Quartz' },
				{ id: 64, text:'Ruby' },
				{ id: 568, text:'Sandstone' },
				{ id: 576, text:'Slate' },
				{ id: 572, text:'Soapstone' },
				{ id: 578, text:'Star Shards' },
				{ id: 558, text:'Thunder Egg' },
				{ id: 562, text:'Tigerseye' },
				{ id: 68, text:'Topaz' },
			]},
			{ id: 'cat_7', text: 'Vegetables', children: [
				{ id: 300, text:'Amaranth' },
				{ id: 274, text:'Artichoke' },
				{ id: 284, text:'Beet' },
				{ id: 278, text:'Bok Choy' },
				{ id: 190, text:'Cauliflower' },
				{ id: 270, text:'Corn' },
				{ id: 272, text:'Eggplant' },
				{ id: 259, text:'Fiddlehead Fern' },
				{ id: 248, text:'Garlic' },
				{ id: 188, text:'Green Bean' },
				{ id: 304, text:'Hops' },
				{ id: 250, text:'Kale' },
				{ id: 24, text:'Parsnip' },
				{ id: 192, text:'Potato' },
				{ id: 276, text:'Pumpkin' },
				{ id: 264, text:'Radish' },
				{ id: 266, text:'Red Cabbage' },
				{ id: 256, text:'Tomato' },
				{ id: 262, text:'Wheat' },
				{ id: 280, text:'Yam' },
			]},
			{ id: 'cat_8', text: '(No Category)', children: [
				{ id: 309, text:'Acorn' },
				{ id: 299, text:'Amaranth Seeds' },
				{ id: 587, text:'Amphibian Fossil' },
				{ id: 117, text:'Anchor' },
				{ id: 103, text:'Ancient Doll' },
				{ id: 123, text:'Ancient Drum' },
				{ id: 114, text:'Ancient Seed' },
				{ id: 499, text:'Ancient Seeds' },
				{ id: 109, text:'Ancient Sword' },
				{ id: 633, text:'Apple Sapling' },
				{ id: 629, text:'Apricot Sapling' },
				{ id: 101, text:'Arrowhead' },
				{ id: 489, text:'Artichoke Seeds' },
				{ id: 685, text:'Bait' },
				{ id: 691, text:'Barbed Hook' },
				{ id: 368, text:'Basic Fertilizer' },
				{ id: 370, text:'Basic Retaining Soil' },
				{ id: 767, text:'Bat Wing' },
				{ id: 787, text:'Battery Pack' },
				{ id: 473, text:'Bean Starter' },
				{ id: 494, text:'Beet Seeds' },
				{ id: 790, text:'Berry Basket' },
				{ id: 413, text:'Blue Slime Egg' },
				{ id: 481, text:'Blueberry Seeds' },
				{ id: 491, text:'Bok Choy Seeds' },
				{ id: 287, text:'Bomb' },
				{ id: 119, text:'Bone Flute' },
				{ id: 458, text:'Bouquet' },
				{ id: 171, text:'Broken CD' },
				{ id: 170, text:'Broken Glasses' },
				{ id: 684, text:'Bug Meat' },
				{ id: 802, text:'Cactus Seeds' },
				{ id: 474, text:'Cauliflower Seeds' },
				{ id: 286, text:'Cherry Bomb' },
				{ id: 628, text:'Cherry Sapling' },
				{ id: 105, text:'Chewing Stick' },
				{ id: 113, text:'Chicken Statue' },
				{ id: 100, text:'Chipped Amphora' },
				{ id: 372, text:'Clam' },
				{ id: 330, text:'Clay' },
				{ id: 382, text:'Coal' },
				{ id: 411, text:'Cobblestone Path' },
				{ id: 395, text:'Coffee' },
				{ id: 433, text:'Coffee Bean' },
				{ id: 334, text:'Copper Bar' },
				{ id: 378, text:'Copper Ore' },
				{ id: 393, text:'Coral' },
				{ id: 695, text:'Cork Bobber' },
				{ id: 487, text:'Corn Seeds' },
				{ id: 710, text:'Crab Pot' },
				{ id: 493, text:'Cranberry Seeds' },
				{ id: 333, text:'Crystal Floor' },
				{ id: 409, text:'Crystal Path' },
				{ id: 466, text:'Deluxe Speed-Gro' },
				{ id: 107, text:'Dinosaur Egg' },
				{ id: 687, text:'Dressed Spinner' },
				{ id: 116, text:'Dried Starfish' },
				{ id: 169, text:'Driftwood' },
				{ id: 463, text:'Drum Block' },
				{ id: 122, text:'Dwarf Gadget' },
				{ id: 96, text:'Dwarf Scroll I' },
				{ id: 97, text:'Dwarf Scroll II' },
				{ id: 98, text:'Dwarf Scroll III' },
				{ id: 99, text:'Dwarf Scroll IV' },
				{ id: 121, text:'Dwarvish Helm' },
				{ id: 488, text:'Eggplant Seeds' },
				{ id: 104, text:'Elvish Jewelry' },
				{ id: 349, text:'Energy Tonic' },
				{ id: 441, text:'Explosive Ammo' },
				{ id: 425, text:'Fairy Seeds' },
				{ id: 497, text:'Fall Seeds' },
				{ id: 771, text:'Fiber' },
				{ id: 403, text:'Field Snack' },
				{ id: 464, text:'Flute Block' },
				{ id: 536, text:'Frozen Geode' },
				{ id: 476, text:'Garlic Seeds' },
				{ id: 325, text:'Gate' },
				{ id: 535, text:'Geode' },
				{ id: 118, text:'Glass Shards' },
				{ id: 336, text:'Gold Bar' },
				{ id: 384, text:'Gold Ore' },
				{ id: 124, text:'Golden Mask' },
				{ id: 373, text:'Golden Pumpkin' },
				{ id: 125, text:'Golden Relic' },
				{ id: 301, text:'Grape Starter' },
				{ id: 297, text:'Grass Starter' },
				{ id: 407, text:'Gravel Path' },
				{ id: 153, text:'Green Algae' },
				{ id: 680, text:'Green Slime Egg' },
				{ id: 709, text:'Hardwood' },
				{ id: 298, text:'Hardwood Fence' },
				{ id: 178, text:'Hay' },
				{ id: 302, text:'Hops Starter' },
				{ id: 337, text:'Iridium Bar' },
				{ id: 803, text:'Iridium Milk' },
				{ id: 386, text:'Iridium Ore' },
				{ id: 645, text:'Iridium Sprinkler' },
				{ id: 335, text:'Iron Bar' },
				{ id: 324, text:'Iron Fence' },
				{ id: 380, text:'Iron Ore' },
				{ id: 746, text:'Jack-O-Lantern' },
				{ id: 429, text:'Jazz Seeds' },
				{ id: 167, text:'Joja Cola' },
				{ id: 477, text:'Kale Seeds' },
				{ id: 692, text:'Lead Bobber' },
				{ id: 788, text:'Lost Axe' },
				{ id: 30, text:'Lumber' },
				{ id: 537, text:'Magma Geode' },
				{ id: 703, text:'Magnet' },
				{ id: 310, text:'Maple Seed' },
				{ id: 288, text:'Mega Bomb' },
				{ id: 479, text:'Melon Seeds' },
				{ id: 460, text:'Mermaid\'s Pendant' },
				{ id: 770, text:'Mixed Seeds' },
				{ id: 351, text:'Muscle Remedy' },
				{ id: 586, text:'Nautilus Fossil' },
				{ id: 392, text:'Nautilus Shell' },
				{ id: 247, text:'Oil' },
				{ id: 749, text:'Omni Geode' },
				{ id: 630, text:'Orange Sapling' },
				{ id: 106, text:'Ornamental Fan' },
				{ id: 588, text:'Palm Fossil' },
				{ id: 472, text:'Parsnip Seeds' },
				{ id: 631, text:'Peach Sapling' },
				{ id: 797, text:'Pearl' },
				{ id: 482, text:'Pepper Seeds' },
				{ id: 311, text:'Pine Cone' },
				{ id: 632, text:'Pomegranate Sapling' },
				{ id: 453, text:'Poppy Seeds' },
				{ id: 475, text:'Potato Seeds' },
				{ id: 120, text:'Prehistoric Handaxe' },
				{ id: 583, text:'Prehistoric Rib' },
				{ id: 579, text:'Prehistoric Scapula' },
				{ id: 581, text:'Prehistoric Skull' },
				{ id: 580, text:'Prehistoric Tibia' },
				{ id: 115, text:'Prehistoric Tool' },
				{ id: 584, text:'Prehistoric Vertebra' },
				{ id: 490, text:'Pumpkin Seeds' },
				{ id: 439, text:'Purple Slime Egg' },
				{ id: 369, text:'Quality Fertilizer' },
				{ id: 371, text:'Quality Retaining Soil' },
				{ id: 621, text:'Quality Sprinkler' },
				{ id: 484, text:'Radish Seeds' },
				{ id: 681, text:'Rain Totem' },
				{ id: 394, text:'Rainbow Shell' },
				{ id: 108, text:'Rare Disc' },
				{ id: 347, text:'Rare Seed' },
				{ id: 485, text:'Red Cabbage Seeds' },
				{ id: 437, text:'Red Slime Egg' },
				{ id: 338, text:'Refined Quartz' },
				{ id: 478, text:'Rhubarb Seeds' },
				{ id: 423, text:'Rice' },
				{ id: 112, text:'Rusty Cog' },
				{ id: 110, text:'Rusty Spoon' },
				{ id: 111, text:'Rusty Spur' },
				{ id: 397, text:'Sea Urchin' },
				{ id: 152, text:'Seaweed' },
				{ id: 582, text:'Skeletal Hand' },
				{ id: 585, text:'Skeletal Tail' },
				{ id: 172, text:'Soggy Newspaper' },
				{ id: 768, text:'Solar Essence' },
				{ id: 455, text:'Spangle Seeds' },
				{ id: 465, text:'Speed-Gro' },
				{ id: 686, text:'Spinner' },
				{ id: 94, text:'Spirit Torch' },
				{ id: 495, text:'Spring Seeds' },
				{ id: 599, text:'Sprinkler' },
				{ id: 434, text:'Stardrop' },
				{ id: 486, text:'Starfruit Seeds' },
				{ id: 415, text:'Stepping Stone Path' },
				{ id: 390, text:'Stone' },
				{ id: 323, text:'Stone Fence' },
				{ id: 329, text:'Stone Floor' },
				{ id: 126, text:'Strange Doll (Green)' },
				{ id: 127, text:'Strange Doll (Yellow)' },
				{ id: 401, text:'Straw Floor' },
				{ id: 745, text:'Strawberry Seeds' },
				{ id: 245, text:'Sugar' },
				{ id: 496, text:'Summer Seeds' },
				{ id: 431, text:'Sunflower Seeds' },
				{ id: 417, text:'Sweet Gem Berry' },
				{ id: 341, text:'Tea Set' },
				{ id: 480, text:'Tomato Seeds' },
				{ id: 93, text:'Torch' },
				{ id: 694, text:'Trap Bobber' },
				{ id: 168, text:'Trash' },
				{ id: 166, text:'Treasure Chest' },
				{ id: 693, text:'Treasure Hunter' },
				{ id: 589, text:'Trilobite' },
				{ id: 430, text:'Truffle' },
				{ id: 427, text:'Tulip Bulb' },
				{ id: 419, text:'Vinegar' },
				{ id: 769, text:'Void Essence' },
				{ id: 690, text:'Warp Totem: Beach' },
				{ id: 688, text:'Warp Totem: Farm' },
				{ id: 689, text:'Warp Totem: Mountains' },
				{ id: 331, text:'Weathered Floor' },
				{ id: 801, text:'Wedding Ring' },
				{ id: 246, text:'Wheat Flour' },
				{ id: 483, text:'Wheat Seeds' },
				{ id: 157, text:'White Algae' },
				{ id: 774, text:'Wild Bait' },
				{ id: 498, text:'Winter Seeds' },
				{ id: 388, text:'Wood' },
				{ id: 322, text:'Wood Fence' },
				{ id: 328, text:'Wood Floor' },
				{ id: 405, text:'Wood Path' },
				{ id: 492, text:'Yam Seeds' },
			]},
			];

		var qual = [
			{ id: 0, text: 'No Star' },
			{ id: 1, text: 'Silver' },
			{ id: 2, text: 'Gold' },
			{ id: 4, text: 'Iridium' },
			];

		$('.quality').select2({ data: qual });
		$('.item').select2({ data: data });
		$("select").change(refreshItem);
		$("#profit_margin").change(changeProfitMargin);
		$("input[type='checkbox']").change(refreshPerks);
		$('.category').prop("disabled", true);
		$('.item_pts').prop("disabled", true);
		$('.location').prop("disabled", true);

		$('.collapsible').each(function() {
			$(this).children('button').click(toggleVisible);
		});

	});
};

perk = {
	'Rancher': false,
	'Tiller': false,
	'Artisan': false,
	'Fisher': false,
	'Angler': false,
	'Forester': false,
	'Tapper': false,
	'Blacksmith': false,
	'Gemologist': false,
	'BearsKnowledge': false,
	'SpringOnionMastery': false,
	'DifficultyModifier': 1.00,
	};

cat_name = [
	'Animal Prod.',
	'Artisan Goods',
	'Cooked Items',
	'Fish',
	'Forage/Flowers',
	'Fruits',
	'Gems/Minerals',
	'Vegetables',
	'(No Category)',
	];
obj_info = {
	"none": { name: "(No Item)", price: 0, fair_cat: 8, real_cat: 0 },
	16: { name: "Wild Horseradish", price: 50, fair_cat: 4, real_cat: -81 },
	18: { name: "Daffodil", price: 30, fair_cat: 4, real_cat: -81 },
	20: { name: "Leek", price: 60, fair_cat: 4, real_cat: -81 },
	22: { name: "Dandelion", price: 40, fair_cat: 4, real_cat: -81 },
	24: { name: "Parsnip", price: 35, fair_cat: 7, real_cat: -75 },
	30: { name: "Lumber", price: 2, fair_cat: 8, real_cat: 0 },
	60: { name: "Emerald", price: 250, fair_cat: 6, real_cat: -2 },
	62: { name: "Aquamarine", price: 180, fair_cat: 6, real_cat: -2 },
	64: { name: "Ruby", price: 250, fair_cat: 6, real_cat: -2 },
	66: { name: "Amethyst", price: 100, fair_cat: 6, real_cat: -2 },
	68: { name: "Topaz", price: 80, fair_cat: 6, real_cat: -2 },
	70: { name: "Jade", price: 200, fair_cat: 6, real_cat: -2 },
	72: { name: "Diamond", price: 750, fair_cat: 6, real_cat: -2 },
	74: { name: "Prismatic Shard", price: 2000, fair_cat: 6, real_cat: -2 },
	78: { name: "Cave Carrot", price: 25, fair_cat: 4, real_cat: -81 },
	80: { name: "Quartz", price: 25, fair_cat: 6, real_cat: -2 },
	82: { name: "Fire Quartz", price: 100, fair_cat: 6, real_cat: -2 },
	84: { name: "Frozen Tear", price: 75, fair_cat: 6, real_cat: -2 },
	86: { name: "Earth Crystal", price: 50, fair_cat: 6, real_cat: -2 },
	88: { name: "Coconut", price: 100, fair_cat: 5, real_cat: -79 },
	90: { name: "Cactus Fruit", price: 75, fair_cat: 5, real_cat: -79 },
	92: { name: "Sap", price: 2, fair_cat: 4, real_cat: -81 },
	93: { name: "Torch", price: 5, fair_cat: 8, real_cat: 0 },
	94: { name: "Spirit Torch", price: 5, fair_cat: 8, real_cat: 0 },
	96: { name: "Dwarf Scroll I", price: 1, fair_cat: 8, real_cat: 0 },
	97: { name: "Dwarf Scroll II", price: 1, fair_cat: 8, real_cat: 0 },
	98: { name: "Dwarf Scroll III", price: 1, fair_cat: 8, real_cat: 0 },
	99: { name: "Dwarf Scroll IV", price: 1, fair_cat: 8, real_cat: 0 },
	100: { name: "Chipped Amphora", price: 40, fair_cat: 8, real_cat: 0 },
	101: { name: "Arrowhead", price: 40, fair_cat: 8, real_cat: 0 },
	103: { name: "Ancient Doll", price: 60, fair_cat: 8, real_cat: 0 },
	104: { name: "Elvish Jewelry", price: 200, fair_cat: 8, real_cat: 0 },
	105: { name: "Chewing Stick", price: 50, fair_cat: 8, real_cat: 0 },
	106: { name: "Ornamental Fan", price: 300, fair_cat: 8, real_cat: 0 },
	107: { name: "Dinosaur Egg", price: 350, fair_cat: 8, real_cat: 0 },
	108: { name: "Rare Disc", price: 300, fair_cat: 8, real_cat: 0 },
	109: { name: "Ancient Sword", price: 100, fair_cat: 8, real_cat: 0 },
	110: { name: "Rusty Spoon", price: 25, fair_cat: 8, real_cat: 0 },
	111: { name: "Rusty Spur", price: 25, fair_cat: 8, real_cat: 0 },
	112: { name: "Rusty Cog", price: 25, fair_cat: 8, real_cat: 0 },
	113: { name: "Chicken Statue", price: 50, fair_cat: 8, real_cat: 0 },
	114: { name: "Ancient Seed", price: 5, fair_cat: 8, real_cat: 0 },
	115: { name: "Prehistoric Tool", price: 50, fair_cat: 8, real_cat: 0 },
	116: { name: "Dried Starfish", price: 40, fair_cat: 8, real_cat: 0 },
	117: { name: "Anchor", price: 100, fair_cat: 8, real_cat: 0 },
	118: { name: "Glass Shards", price: 20, fair_cat: 8, real_cat: 0 },
	119: { name: "Bone Flute", price: 100, fair_cat: 8, real_cat: 0 },
	120: { name: "Prehistoric Handaxe", price: 50, fair_cat: 8, real_cat: 0 },
	121: { name: "Dwarvish Helm", price: 100, fair_cat: 8, real_cat: 0 },
	122: { name: "Dwarf Gadget", price: 200, fair_cat: 8, real_cat: 0 },
	123: { name: "Ancient Drum", price: 100, fair_cat: 8, real_cat: 0 },
	124: { name: "Golden Mask", price: 500, fair_cat: 8, real_cat: 0 },
	125: { name: "Golden Relic", price: 250, fair_cat: 8, real_cat: 0 },
	126: { name: "Strange Doll (Green)", price: 1000, fair_cat: 8, real_cat: 0 },
	127: { name: "Strange Doll (Yellow)", price: 1000, fair_cat: 8, real_cat: 0 },
	128: { name: "Pufferfish", price: 200, fair_cat: 3, real_cat: -4 },
	129: { name: "Anchovy", price: 30, fair_cat: 3, real_cat: -4 },
	130: { name: "Tuna", price: 100, fair_cat: 3, real_cat: -4 },
	131: { name: "Sardine", price: 40, fair_cat: 3, real_cat: -4 },
	132: { name: "Bream", price: 45, fair_cat: 3, real_cat: -4 },
	136: { name: "Largemouth Bass", price: 100, fair_cat: 3, real_cat: -4 },
	137: { name: "Smallmouth Bass", price: 50, fair_cat: 3, real_cat: -4 },
	138: { name: "Rainbow Trout", price: 65, fair_cat: 3, real_cat: -4 },
	139: { name: "Salmon", price: 75, fair_cat: 3, real_cat: -4 },
	140: { name: "Walleye", price: 105, fair_cat: 3, real_cat: -4 },
	141: { name: "Perch", price: 55, fair_cat: 3, real_cat: -4 },
	142: { name: "Carp", price: 30, fair_cat: 3, real_cat: -4 },
	143: { name: "Catfish", price: 200, fair_cat: 3, real_cat: -4 },
	144: { name: "Pike", price: 100, fair_cat: 3, real_cat: -4 },
	145: { name: "Sunfish", price: 30, fair_cat: 3, real_cat: -4 },
	146: { name: "Red Mullet", price: 75, fair_cat: 3, real_cat: -4 },
	147: { name: "Herring", price: 30, fair_cat: 3, real_cat: -4 },
	148: { name: "Eel", price: 85, fair_cat: 3, real_cat: -4 },
	149: { name: "Octopus", price: 150, fair_cat: 3, real_cat: -4 },
	150: { name: "Red Snapper", price: 50, fair_cat: 3, real_cat: -4 },
	151: { name: "Squid", price: 80, fair_cat: 3, real_cat: -4 },
	152: { name: "Seaweed", price: 20, fair_cat: 8, real_cat: 0 },
	153: { name: "Green Algae", price: 15, fair_cat: 8, real_cat: 0 },
	154: { name: "Sea Cucumber", price: 75, fair_cat: 3, real_cat: -4 },
	155: { name: "Super Cucumber", price: 250, fair_cat: 3, real_cat: -4 },
	156: { name: "Ghostfish", price: 45, fair_cat: 3, real_cat: -4 },
	157: { name: "White Algae", price: 25, fair_cat: 8, real_cat: 0 },
	158: { name: "Stonefish", price: 300, fair_cat: 3, real_cat: -4 },
	159: { name: "Crimsonfish", price: 1500, fair_cat: 3, real_cat: -4 },
	160: { name: "Angler", price: 900, fair_cat: 3, real_cat: -4 },
	161: { name: "Ice Pip", price: 500, fair_cat: 3, real_cat: -4 },
	162: { name: "Lava Eel", price: 700, fair_cat: 3, real_cat: -4 },
	163: { name: "Legend", price: 5000, fair_cat: 3, real_cat: -4 },
	164: { name: "Sandfish", price: 75, fair_cat: 3, real_cat: -4 },
	165: { name: "Scorpion Carp", price: 150, fair_cat: 3, real_cat: -4 },
	166: { name: "Treasure Chest", price: 5000, fair_cat: 8, real_cat: 0 },
	167: { name: "Joja Cola", price: 25, fair_cat: 8, real_cat: -20 },
	168: { name: "Trash", price: 0, fair_cat: 8, real_cat: -20 },
	169: { name: "Driftwood", price: 0, fair_cat: 8, real_cat: -20 },
	170: { name: "Broken Glasses", price: 0, fair_cat: 8, real_cat: -20 },
	171: { name: "Broken CD", price: 0, fair_cat: 8, real_cat: -20 },
	172: { name: "Soggy Newspaper", price: 0, fair_cat: 8, real_cat: -20 },
	174: { name: "Large Egg (White)", price: 95, fair_cat: 0, real_cat: -5 },
	176: { name: "Egg (White)", price: 50, fair_cat: 0, real_cat: -5 },
	178: { name: "Hay", price: 0, fair_cat: 8, real_cat: 0 },
	180: { name: "Egg (Brown)", price: 50, fair_cat: 0, real_cat: -5 },
	182: { name: "Large Egg (Brown)", price: 95, fair_cat: 0, real_cat: -5 },
	184: { name: "Milk", price: 125, fair_cat: 0, real_cat: -6 },
	186: { name: "Large Milk", price: 190, fair_cat: 0, real_cat: -6 },
	188: { name: "Green Bean", price: 40, fair_cat: 7, real_cat: -75 },
	190: { name: "Cauliflower", price: 175, fair_cat: 7, real_cat: -75 },
	192: { name: "Potato", price: 80, fair_cat: 7, real_cat: -75 },
	194: { name: "Fried Egg", price: 35, fair_cat: 2, real_cat: -7 },
	195: { name: "Omelet", price: 125, fair_cat: 2, real_cat: -7 },
	196: { name: "Salad", price: 110, fair_cat: 2, real_cat: -7 },
	197: { name: "Cheese Cauliflower", price: 300, fair_cat: 2, real_cat: -7 },
	198: { name: "Baked Fish", price: 100, fair_cat: 2, real_cat: -7 },
	199: { name: "Parsnip Soup", price: 120, fair_cat: 2, real_cat: -7 },
	200: { name: "Vegetable Medley", price: 120, fair_cat: 2, real_cat: -7 },
	201: { name: "Complete Breakfast", price: 350, fair_cat: 2, real_cat: -7 },
	202: { name: "Fried Calamari", price: 150, fair_cat: 2, real_cat: -7 },
	203: { name: "Strange Bun", price: 225, fair_cat: 2, real_cat: -7 },
	204: { name: "Lucky Lunch", price: 250, fair_cat: 2, real_cat: -7 },
	205: { name: "Fried Mushroom", price: 200, fair_cat: 2, real_cat: -7 },
	206: { name: "Pizza", price: 300, fair_cat: 2, real_cat: -7 },
	207: { name: "Bean Hotpot", price: 100, fair_cat: 2, real_cat: -7 },
	208: { name: "Glazed Yams", price: 200, fair_cat: 2, real_cat: -7 },
	209: { name: "Carp Surprise", price: 150, fair_cat: 2, real_cat: -7 },
	210: { name: "Hashbrowns", price: 120, fair_cat: 2, real_cat: -7 },
	211: { name: "Pancakes", price: 80, fair_cat: 2, real_cat: -7 },
	212: { name: "Salmon Dinner", price: 300, fair_cat: 2, real_cat: -7 },
	213: { name: "Fish Taco", price: 500, fair_cat: 2, real_cat: -7 },
	214: { name: "Crispy Bass", price: 150, fair_cat: 2, real_cat: -7 },
	215: { name: "Pepper Poppers", price: 200, fair_cat: 2, real_cat: -7 },
	216: { name: "Bread", price: 60, fair_cat: 2, real_cat: -7 },
	218: { name: "Tom Kha Soup", price: 250, fair_cat: 2, real_cat: -7 },
	219: { name: "Trout Soup", price: 100, fair_cat: 2, real_cat: -7 },
	220: { name: "Chocolate Cake", price: 200, fair_cat: 2, real_cat: -7 },
	221: { name: "Pink Cake", price: 480, fair_cat: 2, real_cat: -7 },
	222: { name: "Rhubarb Pie", price: 400, fair_cat: 2, real_cat: -7 },
	223: { name: "Cookie", price: 140, fair_cat: 2, real_cat: -7 },
	224: { name: "Spaghetti", price: 120, fair_cat: 2, real_cat: -7 },
	225: { name: "Fried Eel", price: 120, fair_cat: 2, real_cat: -7 },
	226: { name: "Spicy Eel", price: 175, fair_cat: 2, real_cat: -7 },
	227: { name: "Sashimi", price: 75, fair_cat: 2, real_cat: -7 },
	228: { name: "Maki Roll", price: 220, fair_cat: 2, real_cat: -7 },
	229: { name: "Tortilla", price: 50, fair_cat: 2, real_cat: -7 },
	230: { name: "Red Plate", price: 400, fair_cat: 2, real_cat: -7 },
	231: { name: "Eggplant Parmesan", price: 200, fair_cat: 2, real_cat: -7 },
	232: { name: "Rice Pudding", price: 260, fair_cat: 2, real_cat: -7 },
	233: { name: "Ice Cream", price: 120, fair_cat: 2, real_cat: -7 },
	234: { name: "Blueberry Tart", price: 150, fair_cat: 2, real_cat: -7 },
	235: { name: "Autumn\'s Bounty", price: 350, fair_cat: 2, real_cat: -7 },
	236: { name: "Pumpkin Soup", price: 300, fair_cat: 2, real_cat: -7 },
	237: { name: "Super Meal", price: 220, fair_cat: 2, real_cat: -7 },
	238: { name: "Cranberry Sauce", price: 120, fair_cat: 2, real_cat: -7 },
	239: { name: "Stuffing", price: 165, fair_cat: 2, real_cat: -7 },
	240: { name: "Farmer\'s Lunch", price: 150, fair_cat: 2, real_cat: -7 },
	241: { name: "Survival Burger", price: 180, fair_cat: 2, real_cat: -7 },
	242: { name: "Dish O\' The Sea", price: 220, fair_cat: 2, real_cat: -7 },
	243: { name: "Miner\'s Treat", price: 200, fair_cat: 2, real_cat: -7 },
	244: { name: "Roots Platter", price: 100, fair_cat: 2, real_cat: -7 },
	245: { name: "Sugar", price: 50, fair_cat: 8, real_cat: 0 },
	246: { name: "Wheat Flour", price: 50, fair_cat: 8, real_cat: 0 },
	247: { name: "Oil", price: 100, fair_cat: 8, real_cat: 0 },
	248: { name: "Garlic", price: 60, fair_cat: 7, real_cat: -75 },
	250: { name: "Kale", price: 110, fair_cat: 7, real_cat: -75 },
	252: { name: "Rhubarb", price: 220, fair_cat: 5, real_cat: -79 },
	254: { name: "Melon", price: 250, fair_cat: 5, real_cat: -79 },
	256: { name: "Tomato", price: 60, fair_cat: 7, real_cat: -75 },
	257: { name: "Morel", price: 150, fair_cat: 4, real_cat: -81 },
	258: { name: "Blueberry", price: 50, fair_cat: 5, real_cat: -79 },
	259: { name: "Fiddlehead Fern", price: 90, fair_cat: 7, real_cat: -75 },
	260: { name: "Hot Pepper", price: 40, fair_cat: 5, real_cat: -79 },
	262: { name: "Wheat", price: 25, fair_cat: 7, real_cat: -75 },
	264: { name: "Radish", price: 90, fair_cat: 7, real_cat: -75 },
	266: { name: "Red Cabbage", price: 260, fair_cat: 7, real_cat: -75 },
	268: { name: "Starfruit", price: 750, fair_cat: 5, real_cat: -79 },
	270: { name: "Corn", price: 50, fair_cat: 7, real_cat: -75 },
	272: { name: "Eggplant", price: 60, fair_cat: 7, real_cat: -75 },
	274: { name: "Artichoke", price: 160, fair_cat: 7, real_cat: -75 },
	276: { name: "Pumpkin", price: 320, fair_cat: 7, real_cat: -75 },
	278: { name: "Bok Choy", price: 80, fair_cat: 7, real_cat: -75 },
	280: { name: "Yam", price: 160, fair_cat: 7, real_cat: -75 },
	281: { name: "Chanterelle", price: 160, fair_cat: 4, real_cat: -81 },
	282: { name: "Cranberries", price: 75, fair_cat: 5, real_cat: -79 },
	283: { name: "Holly", price: 80, fair_cat: 4, real_cat: -81 },
	284: { name: "Beet", price: 100, fair_cat: 7, real_cat: -75 },
	286: { name: "Cherry Bomb", price: 50, fair_cat: 8, real_cat: -8 },
	287: { name: "Bomb", price: 50, fair_cat: 8, real_cat: -8 },
	288: { name: "Mega Bomb", price: 50, fair_cat: 8, real_cat: -8 },
	296: { name: "Salmonberry", price: 5, fair_cat: 5, real_cat: -79 },
	297: { name: "Grass Starter", price: 50, fair_cat: 8, real_cat: 0 },
	298: { name: "Hardwood Fence", price: 10, fair_cat: 8, real_cat: -8 },
	299: { name: "Amaranth Seeds", price: 35, fair_cat: 8, real_cat: -74 },
	300: { name: "Amaranth", price: 150, fair_cat: 7, real_cat: -75 },
	301: { name: "Grape Starter", price: 30, fair_cat: 8, real_cat: -74 },
	302: { name: "Hops Starter", price: 30, fair_cat: 8, real_cat: -74 },
	303: { name: "Pale Ale", price: 300, fair_cat: 1, real_cat: -26 },
	304: { name: "Hops", price: 25, fair_cat: 7, real_cat: -75 },
	305: { name: "Void Egg", price: 65, fair_cat: 0, real_cat: -5 },
	306: { name: "Mayonnaise", price: 190, fair_cat: 1, real_cat: -26 },
	307: { name: "Duck Mayonnaise", price: 375, fair_cat: 1, real_cat: -26 },
	308: { name: "Void Mayonnaise", price: 275, fair_cat: 1, real_cat: -26 },
	309: { name: "Acorn", price: 20, fair_cat: 8, real_cat: -74 },
	310: { name: "Maple Seed", price: 5, fair_cat: 8, real_cat: -74 },
	311: { name: "Pine Cone", price: 5, fair_cat: 8, real_cat: -74 },
	322: { name: "Wood Fence", price: 1, fair_cat: 8, real_cat: -8 },
	323: { name: "Stone Fence", price: 2, fair_cat: 8, real_cat: -8 },
	324: { name: "Iron Fence", price: 6, fair_cat: 8, real_cat: -8 },
	325: { name: "Gate", price: 4, fair_cat: 8, real_cat: -8 },
	328: { name: "Wood Floor", price: 1, fair_cat: 8, real_cat: -24 },
	329: { name: "Stone Floor", price: 1, fair_cat: 8, real_cat: -24 },
	330: { name: "Clay", price: 20, fair_cat: 8, real_cat: -16 },
	331: { name: "Weathered Floor", price: 1, fair_cat: 8, real_cat: -24 },
	333: { name: "Crystal Floor", price: 1, fair_cat: 8, real_cat: -24 },
	334: { name: "Copper Bar", price: 60, fair_cat: 8, real_cat: -15 },
	335: { name: "Iron Bar", price: 120, fair_cat: 8, real_cat: -15 },
	336: { name: "Gold Bar", price: 250, fair_cat: 8, real_cat: -15 },
	337: { name: "Iridium Bar", price: 1000, fair_cat: 8, real_cat: -15 },
	338: { name: "Refined Quartz", price: 50, fair_cat: 8, real_cat: -15 },
	340: { name: "Wild Honey", price: 100, fair_cat: 1, real_cat: -26 },
	341: { name: "Tea Set", price: 200, fair_cat: 8, real_cat: -24 },
	342: { name: "Pickles (Generic)", price: 100, fair_cat: 1, real_cat: -26 },
	344: { name: "Jelly (Generic)", price: 160, fair_cat: 1, real_cat: -26 },
	346: { name: "Beer", price: 200, fair_cat: 1, real_cat: -26 },
	347: { name: "Rare Seed", price: 200, fair_cat: 8, real_cat: -74 },
	348: { name: "Wine (Generic)", price: 400, fair_cat: 1, real_cat: -26 },
	349: { name: "Energy Tonic", price: 500, fair_cat: 8, real_cat: 0 },
	350: { name: "Juice (Generic)", price: 150, fair_cat: 1, real_cat: -26 },
	351: { name: "Muscle Remedy", price: 500, fair_cat: 8, real_cat: 0 },
	368: { name: "Basic Fertilizer", price: 2, fair_cat: 8, real_cat: -19 },
	369: { name: "Quality Fertilizer", price: 10, fair_cat: 8, real_cat: -19 },
	370: { name: "Basic Retaining Soil", price: 4, fair_cat: 8, real_cat: -19 },
	371: { name: "Quality Retaining Soil", price: 5, fair_cat: 8, real_cat: -19 },
	372: { name: "Clam", price: 50, fair_cat: 8, real_cat: -23 },
	373: { name: "Golden Pumpkin", price: 2500, fair_cat: 8, real_cat: 0 },
	376: { name: "Poppy", price: 140, fair_cat: 4, real_cat: -80 },
	378: { name: "Copper Ore", price: 5, fair_cat: 8, real_cat: -15 },
	380: { name: "Iron Ore", price: 10, fair_cat: 8, real_cat: -15 },
	382: { name: "Coal", price: 15, fair_cat: 8, real_cat: -15 },
	384: { name: "Gold Ore", price: 25, fair_cat: 8, real_cat: -15 },
	386: { name: "Iridium Ore", price: 100, fair_cat: 8, real_cat: -15 },
	388: { name: "Wood", price: 2, fair_cat: 8, real_cat: -16 },
	390: { name: "Stone", price: 2, fair_cat: 8, real_cat: -16 },
	392: { name: "Nautilus Shell", price: 120, fair_cat: 8, real_cat: -23 },
	393: { name: "Coral", price: 80, fair_cat: 8, real_cat: -23 },
	394: { name: "Rainbow Shell", price: 300, fair_cat: 8, real_cat: -23 },
	395: { name: "Coffee", price: 150, fair_cat: 8, real_cat: 0 },
	396: { name: "Spice Berry", price: 80, fair_cat: 5, real_cat: -79 },
	397: { name: "Sea Urchin", price: 160, fair_cat: 8, real_cat: -23 },
	398: { name: "Grape", price: 80, fair_cat: 5, real_cat: -79 },
	399: { name: "Spring Onion", price: 8, fair_cat: 4, real_cat: -81 },
	400: { name: "Strawberry", price: 120, fair_cat: 5, real_cat: -79 },
	401: { name: "Straw Floor", price: 1, fair_cat: 8, real_cat: -24 },
	402: { name: "Sweet Pea", price: 50, fair_cat: 4, real_cat: -80 },
	403: { name: "Field Snack", price: 20, fair_cat: 8, real_cat: 0 },
	404: { name: "Common Mushroom", price: 40, fair_cat: 4, real_cat: -81 },
	405: { name: "Wood Path", price: 1, fair_cat: 8, real_cat: -24 },
	406: { name: "Wild Plum", price: 80, fair_cat: 5, real_cat: -79 },
	407: { name: "Gravel Path", price: 1, fair_cat: 8, real_cat: -24 },
	408: { name: "Hazelnut", price: 90, fair_cat: 4, real_cat: -81 },
	409: { name: "Crystal Path", price: 1, fair_cat: 8, real_cat: -24 },
	410: { name: "Blackberry", price: 20, fair_cat: 5, real_cat: -79 },
	411: { name: "Cobblestone Path", price: 1, fair_cat: 8, real_cat: -24 },
	412: { name: "Winter Root", price: 70, fair_cat: 4, real_cat: -81 },
	413: { name: "Blue Slime Egg", price: 1750, fair_cat: 8, real_cat: 0 },
	414: { name: "Crystal Fruit", price: 150, fair_cat: 5, real_cat: -79 },
	415: { name: "Stepping Stone Path", price: 1, fair_cat: 8, real_cat: -24 },
	416: { name: "Snow Yam", price: 100, fair_cat: 4, real_cat: -81 },
	417: { name: "Sweet Gem Berry", price: 3000, fair_cat: 8, real_cat: -17 },
	418: { name: "Crocus", price: 60, fair_cat: 4, real_cat: -80 },
	419: { name: "Vinegar", price: 100, fair_cat: 8, real_cat: 0 },
	420: { name: "Red Mushroom", price: 75, fair_cat: 4, real_cat: -81 },
	421: { name: "Sunflower", price: 80, fair_cat: 4, real_cat: -80 },
	422: { name: "Purple Mushroom", price: 250, fair_cat: 4, real_cat: -81 },
	423: { name: "Rice", price: 100, fair_cat: 8, real_cat: 0 },
	424: { name: "Cheese", price: 200, fair_cat: 1, real_cat: -26 },
	425: { name: "Fairy Seeds", price: 100, fair_cat: 8, real_cat: -74 },
	426: { name: "Goat Cheese", price: 375, fair_cat: 1, real_cat: -26 },
	427: { name: "Tulip Bulb", price: 10, fair_cat: 8, real_cat: -74 },
	428: { name: "Cloth", price: 470, fair_cat: 1, real_cat: -26 },
	429: { name: "Jazz Seeds", price: 15, fair_cat: 8, real_cat: -74 },
	430: { name: "Truffle", price: 625, fair_cat: 8, real_cat: -17 },
	431: { name: "Sunflower Seeds", price: 20, fair_cat: 8, real_cat: -74 },
	432: { name: "Truffle Oil", price: 1065, fair_cat: 1, real_cat: -26 },
	433: { name: "Coffee Bean", price: 15, fair_cat: 8, real_cat: -74 },
	434: { name: "Stardrop", price: 7777, fair_cat: 8, real_cat: 0 },
	436: { name: "Goat Milk", price: 225, fair_cat: 0, real_cat: -6 },
	437: { name: "Red Slime Egg", price: 2500, fair_cat: 8, real_cat: 0 },
	438: { name: "L. Goat Milk", price: 345, fair_cat: 0, real_cat: -6 },
	439: { name: "Purple Slime Egg", price: 5000, fair_cat: 8, real_cat: 0 },
	440: { name: "Wool", price: 340, fair_cat: 0, real_cat: -18 },
	441: { name: "Explosive Ammo", price: 20, fair_cat: 8, real_cat: 0 },
	442: { name: "Duck Egg", price: 95, fair_cat: 0, real_cat: -5 },
	444: { name: "Duck Feather", price: 125, fair_cat: 0, real_cat: -18 },
	446: { name: "Rabbit\'s Foot", price: 565, fair_cat: 0, real_cat: -18 },
	453: { name: "Poppy Seeds", price: 50, fair_cat: 8, real_cat: -74 },
	454: { name: "Ancient Fruit", price: 550, fair_cat: 5, real_cat: -79 },
	455: { name: "Spangle Seeds", price: 25, fair_cat: 8, real_cat: -74 },
	456: { name: "Algae Soup", price: 100, fair_cat: 2, real_cat: -7 },
	457: { name: "Pale Broth", price: 150, fair_cat: 2, real_cat: -7 },
	458: { name: "Bouquet", price: 100, fair_cat: 8, real_cat: 0 },
	459: { name: "Mead", price: 200, fair_cat: 1, real_cat: -26 },
	460: { name: "Mermaid\'s Pendant", price: 2500, fair_cat: 8, real_cat: 0 },
	463: { name: "Drum Block", price: 100, fair_cat: 8, real_cat: 0 },
	464: { name: "Flute Block", price: 100, fair_cat: 8, real_cat: 0 },
	465: { name: "Speed-Gro", price: 20, fair_cat: 8, real_cat: -19 },
	466: { name: "Deluxe Speed-Gro", price: 40, fair_cat: 8, real_cat: -19 },
	472: { name: "Parsnip Seeds", price: 10, fair_cat: 8, real_cat: -74 },
	473: { name: "Bean Starter", price: 30, fair_cat: 8, real_cat: -74 },
	474: { name: "Cauliflower Seeds", price: 40, fair_cat: 8, real_cat: -74 },
	475: { name: "Potato Seeds", price: 25, fair_cat: 8, real_cat: -74 },
	476: { name: "Garlic Seeds", price: 20, fair_cat: 8, real_cat: -74 },
	477: { name: "Kale Seeds", price: 35, fair_cat: 8, real_cat: -74 },
	478: { name: "Rhubarb Seeds", price: 50, fair_cat: 8, real_cat: -74 },
	479: { name: "Melon Seeds", price: 40, fair_cat: 8, real_cat: -74 },
	480: { name: "Tomato Seeds", price: 25, fair_cat: 8, real_cat: -74 },
	481: { name: "Blueberry Seeds", price: 40, fair_cat: 8, real_cat: -74 },
	482: { name: "Pepper Seeds", price: 20, fair_cat: 8, real_cat: -74 },
	483: { name: "Wheat Seeds", price: 5, fair_cat: 8, real_cat: -74 },
	484: { name: "Radish Seeds", price: 20, fair_cat: 8, real_cat: -74 },
	485: { name: "Red Cabbage Seeds", price: 50, fair_cat: 8, real_cat: -74 },
	486: { name: "Starfruit Seeds", price: 200, fair_cat: 8, real_cat: -74 },
	487: { name: "Corn Seeds", price: 75, fair_cat: 8, real_cat: -74 },
	488: { name: "Eggplant Seeds", price: 10, fair_cat: 8, real_cat: -74 },
	489: { name: "Artichoke Seeds", price: 15, fair_cat: 8, real_cat: -74 },
	490: { name: "Pumpkin Seeds", price: 50, fair_cat: 8, real_cat: -74 },
	491: { name: "Bok Choy Seeds", price: 25, fair_cat: 8, real_cat: -74 },
	492: { name: "Yam Seeds", price: 30, fair_cat: 8, real_cat: -74 },
	493: { name: "Cranberry Seeds", price: 120, fair_cat: 8, real_cat: -74 },
	494: { name: "Beet Seeds", price: 10, fair_cat: 8, real_cat: -74 },
	495: { name: "Spring Seeds", price: 35, fair_cat: 8, real_cat: -74 },
	496: { name: "Summer Seeds", price: 55, fair_cat: 8, real_cat: -74 },
	497: { name: "Fall Seeds", price: 45, fair_cat: 8, real_cat: -74 },
	498: { name: "Winter Seeds", price: 30, fair_cat: 8, real_cat: -74 },
	499: { name: "Ancient Seeds", price: 30, fair_cat: 8, real_cat: -74 },
	535: { name: "Geode", price: 50, fair_cat: 8, real_cat: 0 },
	536: { name: "Frozen Geode", price: 100, fair_cat: 8, real_cat: 0 },
	537: { name: "Magma Geode", price: 150, fair_cat: 8, real_cat: 0 },
	538: { name: "Alamite", price: 150, fair_cat: 6, real_cat: -12 },
	539: { name: "Bixite", price: 300, fair_cat: 6, real_cat: -12 },
	540: { name: "Baryte", price: 50, fair_cat: 6, real_cat: -12 },
	541: { name: "Aerinite", price: 125, fair_cat: 6, real_cat: -12 },
	542: { name: "Calcite", price: 75, fair_cat: 6, real_cat: -12 },
	543: { name: "Dolomite", price: 300, fair_cat: 6, real_cat: -12 },
	544: { name: "Esperite", price: 100, fair_cat: 6, real_cat: -12 },
	545: { name: "Fluorapatite", price: 200, fair_cat: 6, real_cat: -12 },
	546: { name: "Geminite", price: 150, fair_cat: 6, real_cat: -12 },
	547: { name: "Helvite", price: 450, fair_cat: 6, real_cat: -12 },
	548: { name: "Jamborite", price: 150, fair_cat: 6, real_cat: -12 },
	549: { name: "Jagoite", price: 115, fair_cat: 6, real_cat: -12 },
	550: { name: "Kyanite", price: 250, fair_cat: 6, real_cat: -12 },
	551: { name: "Lunarite", price: 200, fair_cat: 6, real_cat: -12 },
	552: { name: "Malachite", price: 100, fair_cat: 6, real_cat: -12 },
	553: { name: "Neptunite", price: 400, fair_cat: 6, real_cat: -12 },
	554: { name: "Lemon Stone", price: 200, fair_cat: 6, real_cat: -12 },
	555: { name: "Nekoite", price: 80, fair_cat: 6, real_cat: -12 },
	556: { name: "Orpiment", price: 80, fair_cat: 6, real_cat: -12 },
	557: { name: "Petrified Slime", price: 120, fair_cat: 6, real_cat: -12 },
	558: { name: "Thunder Egg", price: 100, fair_cat: 6, real_cat: -12 },
	559: { name: "Pyrite", price: 120, fair_cat: 6, real_cat: -12 },
	560: { name: "Ocean Stone", price: 220, fair_cat: 6, real_cat: -12 },
	561: { name: "Ghost Crystal", price: 200, fair_cat: 6, real_cat: -12 },
	562: { name: "Tigerseye", price: 275, fair_cat: 6, real_cat: -12 },
	563: { name: "Jasper", price: 150, fair_cat: 6, real_cat: -12 },
	564: { name: "Opal", price: 150, fair_cat: 6, real_cat: -12 },
	565: { name: "Fire Opal", price: 350, fair_cat: 6, real_cat: -12 },
	566: { name: "Celestine", price: 125, fair_cat: 6, real_cat: -12 },
	567: { name: "Marble", price: 110, fair_cat: 6, real_cat: -12 },
	568: { name: "Sandstone", price: 60, fair_cat: 6, real_cat: -12 },
	569: { name: "Granite", price: 75, fair_cat: 6, real_cat: -12 },
	570: { name: "Basalt", price: 175, fair_cat: 6, real_cat: -12 },
	571: { name: "Limestone", price: 15, fair_cat: 6, real_cat: -12 },
	572: { name: "Soapstone", price: 120, fair_cat: 6, real_cat: -12 },
	573: { name: "Hematite", price: 150, fair_cat: 6, real_cat: -12 },
	574: { name: "Mudstone", price: 25, fair_cat: 6, real_cat: -12 },
	575: { name: "Obsidian", price: 200, fair_cat: 6, real_cat: -12 },
	576: { name: "Slate", price: 85, fair_cat: 6, real_cat: -12 },
	577: { name: "Fairy Stone", price: 250, fair_cat: 6, real_cat: -12 },
	578: { name: "Star Shards", price: 500, fair_cat: 6, real_cat: -12 },
	579: { name: "Prehistoric Scapula", price: 100, fair_cat: 8, real_cat: 0 },
	580: { name: "Prehistoric Tibia", price: 100, fair_cat: 8, real_cat: 0 },
	581: { name: "Prehistoric Skull", price: 100, fair_cat: 8, real_cat: 0 },
	582: { name: "Skeletal Hand", price: 100, fair_cat: 8, real_cat: 0 },
	583: { name: "Prehistoric Rib", price: 100, fair_cat: 8, real_cat: 0 },
	584: { name: "Prehistoric Vertebra", price: 100, fair_cat: 8, real_cat: 0 },
	585: { name: "Skeletal Tail", price: 100, fair_cat: 8, real_cat: 0 },
	586: { name: "Nautilus Fossil", price: 80, fair_cat: 8, real_cat: 0 },
	587: { name: "Amphibian Fossil", price: 150, fair_cat: 8, real_cat: 0 },
	588: { name: "Palm Fossil", price: 100, fair_cat: 8, real_cat: 0 },
	589: { name: "Trilobite", price: 50, fair_cat: 8, real_cat: 0 },
	591: { name: "Tulip", price: 30, fair_cat: 4, real_cat: -80 },
	593: { name: "Summer Spangle", price: 90, fair_cat: 4, real_cat: -80 },
	595: { name: "Fairy Rose", price: 290, fair_cat: 4, real_cat: -80 },
	597: { name: "Blue Jazz", price: 50, fair_cat: 4, real_cat: -80 },
	599: { name: "Sprinkler", price: 100, fair_cat: 8, real_cat: -8 },
	604: { name: "Plum Pudding", price: 260, fair_cat: 2, real_cat: -7 },
	605: { name: "Artichoke Dip", price: 210, fair_cat: 2, real_cat: -7 },
	606: { name: "Stir Fry", price: 335, fair_cat: 2, real_cat: -7 },
	607: { name: "Roasted Hazelnuts", price: 270, fair_cat: 2, real_cat: -7 },
	608: { name: "Pumpkin Pie", price: 385, fair_cat: 2, real_cat: -7 },
	609: { name: "Radish Salad", price: 300, fair_cat: 2, real_cat: -7 },
	610: { name: "Fruit Salad", price: 450, fair_cat: 2, real_cat: -7 },
	611: { name: "Blackberry Cobbler", price: 260, fair_cat: 2, real_cat: -7 },
	612: { name: "Cranberry Candy", price: 175, fair_cat: 2, real_cat: -7 },
	613: { name: "Apple", price: 100, fair_cat: 5, real_cat: -79 },
	618: { name: "Bruschetta", price: 210, fair_cat: 2, real_cat: -7 },
	621: { name: "Quality Sprinkler", price: 450, fair_cat: 8, real_cat: -8 },
	628: { name: "Cherry Sapling", price: 850, fair_cat: 8, real_cat: -74 },
	629: { name: "Apricot Sapling", price: 500, fair_cat: 8, real_cat: -74 },
	630: { name: "Orange Sapling", price: 1000, fair_cat: 8, real_cat: -74 },
	631: { name: "Peach Sapling", price: 1500, fair_cat: 8, real_cat: -74 },
	632: { name: "Pomegranate Sapling", price: 1500, fair_cat: 8, real_cat: -74 },
	633: { name: "Apple Sapling", price: 1000, fair_cat: 8, real_cat: -74 },
	634: { name: "Apricot", price: 50, fair_cat: 5, real_cat: -79 },
	635: { name: "Orange", price: 100, fair_cat: 5, real_cat: -79 },
	636: { name: "Peach", price: 140, fair_cat: 5, real_cat: -79 },
	637: { name: "Pomegranate", price: 140, fair_cat: 5, real_cat: -79 },
	638: { name: "Cherry", price: 80, fair_cat: 5, real_cat: -79 },
	645: { name: "Iridium Sprinkler", price: 1000, fair_cat: 8, real_cat: -8 },
	648: { name: "Coleslaw", price: 345, fair_cat: 2, real_cat: -7 },
	649: { name: "Fiddlehead Risotto", price: 350, fair_cat: 2, real_cat: -7 },
	651: { name: "Poppyseed Muffin", price: 250, fair_cat: 2, real_cat: -7 },
	680: { name: "Green Slime Egg", price: 1000, fair_cat: 8, real_cat: 0 },
	681: { name: "Rain Totem", price: 20, fair_cat: 8, real_cat: 0 },
	682: { name: "Mutant Carp", price: 1000, fair_cat: 3, real_cat: -4 },
	684: { name: "Bug Meat", price: 8, fair_cat: 8, real_cat: -28 },
	685: { name: "Bait", price: 1, fair_cat: 8, real_cat: -21 },
	686: { name: "Spinner", price: 250, fair_cat: 8, real_cat: -22 },
	687: { name: "Dressed Spinner", price: 500, fair_cat: 8, real_cat: -22 },
	688: { name: "Warp Totem: Farm", price: 20, fair_cat: 8, real_cat: 0 },
	689: { name: "Warp Totem: Mountains", price: 20, fair_cat: 8, real_cat: 0 },
	690: { name: "Warp Totem: Beach", price: 20, fair_cat: 8, real_cat: 0 },
	691: { name: "Barbed Hook", price: 500, fair_cat: 8, real_cat: -22 },
	692: { name: "Lead Bobber", price: 150, fair_cat: 8, real_cat: -22 },
	693: { name: "Treasure Hunter", price: 250, fair_cat: 8, real_cat: -22 },
	694: { name: "Trap Bobber", price: 200, fair_cat: 8, real_cat: -22 },
	695: { name: "Cork Bobber", price: 250, fair_cat: 8, real_cat: -22 },
	698: { name: "Sturgeon", price: 200, fair_cat: 3, real_cat: -4 },
	699: { name: "Tiger Trout", price: 150, fair_cat: 3, real_cat: -4 },
	700: { name: "Bullhead", price: 75, fair_cat: 3, real_cat: -4 },
	701: { name: "Tilapia", price: 75, fair_cat: 3, real_cat: -4 },
	702: { name: "Chub", price: 50, fair_cat: 3, real_cat: -4 },
	703: { name: "Magnet", price: 15, fair_cat: 8, real_cat: -21 },
	704: { name: "Dorado", price: 100, fair_cat: 3, real_cat: -4 },
	705: { name: "Albacore", price: 75, fair_cat: 3, real_cat: -4 },
	706: { name: "Shad", price: 60, fair_cat: 3, real_cat: -4 },
	707: { name: "Lingcod", price: 120, fair_cat: 3, real_cat: -4 },
	708: { name: "Halibut", price: 80, fair_cat: 3, real_cat: -4 },
	709: { name: "Hardwood", price: 15, fair_cat: 8, real_cat: -16 },
	710: { name: "Crab Pot", price: 50, fair_cat: 8, real_cat: 0 },
	715: { name: "Lobster", price: 120, fair_cat: 3, real_cat: -4 },
	716: { name: "Crayfish", price: 75, fair_cat: 3, real_cat: -4 },
	717: { name: "Crab", price: 100, fair_cat: 3, real_cat: -4 },
	718: { name: "Cockle", price: 50, fair_cat: 3, real_cat: -4 },
	719: { name: "Mussel", price: 30, fair_cat: 3, real_cat: -4 },
	720: { name: "Shrimp", price: 60, fair_cat: 3, real_cat: -4 },
	721: { name: "Snail", price: 65, fair_cat: 3, real_cat: -4 },
	722: { name: "Periwinkle", price: 20, fair_cat: 3, real_cat: -4 },
	723: { name: "Oyster", price: 40, fair_cat: 3, real_cat: -4 },
	724: { name: "Maple Syrup", price: 200, fair_cat: 4, real_cat: -27 },
	725: { name: "Oak Resin", price: 150, fair_cat: 4, real_cat: -27 },
	726: { name: "Pine Tar", price: 100, fair_cat: 4, real_cat: -27 },
	727: { name: "Chowder", price: 135, fair_cat: 2, real_cat: -7 },
	728: { name: "Fish Stew", price: 175, fair_cat: 2, real_cat: -7 },
	729: { name: "Escargot", price: 125, fair_cat: 2, real_cat: -7 },
	730: { name: "Lobster Bisque", price: 205, fair_cat: 2, real_cat: -7 },
	731: { name: "Maple Bar", price: 300, fair_cat: 2, real_cat: -7 },
	732: { name: "Crab Cakes", price: 275, fair_cat: 2, real_cat: -7 },
	734: { name: "Woodskip", price: 75, fair_cat: 3, real_cat: -4 },
	745: { name: "Strawberry Seeds", price: 0, fair_cat: 8, real_cat: -74 },
	746: { name: "Jack-O-Lantern", price: 0, fair_cat: 8, real_cat: -8 },
	749: { name: "Omni Geode", price: 0, fair_cat: 8, real_cat: 0 },
	767: { name: "Bat Wing", price: 15, fair_cat: 8, real_cat: -28 },
	768: { name: "Solar Essence", price: 40, fair_cat: 8, real_cat: -28 },
	769: { name: "Void Essence", price: 50, fair_cat: 8, real_cat: -28 },
	770: { name: "Mixed Seeds", price: 0, fair_cat: 8, real_cat: -74 },
	771: { name: "Fiber", price: 1, fair_cat: 8, real_cat: -16 },
	772: { name: "Oil of Garlic", price: 1000, fair_cat: 2, real_cat: -7 },
	773: { name: "Life Elixir", price: 500, fair_cat: 2, real_cat: -7 },
	774: { name: "Wild Bait", price: 15, fair_cat: 8, real_cat: -21 },
	775: { name: "Glacierfish", price: 1000, fair_cat: 3, real_cat: -4 },
	787: { name: "Battery Pack", price: 500, fair_cat: 8, real_cat: -16 },
	788: { name: "Lost Axe", price: 0, fair_cat: 8, real_cat: 0 },
	790: { name: "Berry Basket", price: 0, fair_cat: 8, real_cat: 0 },
	795: { name: "Void Salmon", price: 150, fair_cat: 3, real_cat: -4 },
	796: { name: "Slimejack", price: 100, fair_cat: 3, real_cat: -4 },
	797: { name: "Pearl", price: 2500, fair_cat: 8, real_cat: 0 },
	798: { name: "Midnight Squid", price: 100, fair_cat: 3, real_cat: -4 },
	799: { name: "Spook Fish", price: 220, fair_cat: 3, real_cat: -4 },
	800: { name: "Blobfish", price: 500, fair_cat: 3, real_cat: -4 },
	801: { name: "Wedding Ring", price: 2000, fair_cat: 8, real_cat: 0 },
	802: { name: "Cactus Seeds", price: 0, fair_cat: 8, real_cat: -74 },
	803: { name: "Iridium Milk", price: 0, fair_cat: 8, real_cat: 0 },
	"348_252": { name: "Rhubarb Wine", price: 660, fair_cat: 1, real_cat: -26 },
	"344_252": { name: "Rhubarb Jelly", price: 490, fair_cat: 1, real_cat: -26 },
	"342_188": { name: "Pickled Green Bean", price: 120, fair_cat: 1, real_cat: -26 },
	"350_188": { name: "Green Bean Juice", price: 130, fair_cat: 1, real_cat: -26 },
	"348_268": { name: "Starfruit Wine", price: 2250, fair_cat: 1, real_cat: -26 },
	"344_268": { name: "Starfruit Jelly", price: 1550, fair_cat: 1, real_cat: -26 },
	"348_88": { name: "Coconut Wine", price: 300, fair_cat: 1, real_cat: -26 },
	"344_88": { name: "Coconut Jelly", price: 250, fair_cat: 1, real_cat: -26 },
	"342_250": { name: "Pickled Kale", price: 330, fair_cat: 1, real_cat: -26 },
	"350_250": { name: "Kale Juice", price: 270, fair_cat: 1, real_cat: -26 },
	"342_280": { name: "Pickled Yam", price: 480, fair_cat: 1, real_cat: -26 },
	"350_280": { name: "Yam Juice", price: 370, fair_cat: 1, real_cat: -26 },
	"348_296": { name: "Salmonberry Wine", price: 15, fair_cat: 1, real_cat: -26 },
	"344_296": { name: "Salmonberry Jelly", price: 60, fair_cat: 1, real_cat: -26 },
	"342_278": { name: "Pickled Bok Choy", price: 240, fair_cat: 1, real_cat: -26 },
	"350_278": { name: "Bok Choy Juice", price: 210, fair_cat: 1, real_cat: -26 },
	"342_300": { name: "Pickled Amaranth", price: 450, fair_cat: 1, real_cat: -26 },
	"350_300": { name: "Amaranth Juice", price: 350, fair_cat: 1, real_cat: -26 },
	"342_190": { name: "Pickled Cauliflower", price: 525, fair_cat: 1, real_cat: -26 },
	"350_190": { name: "Cauliflower Juice", price: 400, fair_cat: 1, real_cat: -26 },
	"348_454": { name: "Ancient Fruit Wine", price: 1650, fair_cat: 1, real_cat: -26 },
	"344_454": { name: "Ancient Fruit Jelly", price: 1150, fair_cat: 1, real_cat: -26 },
	"348_282": { name: "Cranberries Wine", price: 225, fair_cat: 1, real_cat: -26 },
	"344_282": { name: "Cranberries Jelly", price: 200, fair_cat: 1, real_cat: -26 },
	"342_304": { name: "Pickled Hops", price: 75, fair_cat: 1, real_cat: -26 },
	"348_258": { name: "Blueberry Wine", price: 150, fair_cat: 1, real_cat: -26 },
	"344_258": { name: "Blueberry Jelly", price: 150, fair_cat: 1, real_cat: -26 },
	"342_192": { name: "Pickled Potato", price: 240, fair_cat: 1, real_cat: -26 },
	"350_192": { name: "Potato Juice", price: 210, fair_cat: 1, real_cat: -26 },
	"340_595": { name: "Fairy Rose Honey", price: 680, fair_cat: 1, real_cat: -26 },
	"348_637": { name: "Pomegranate Wine", price: 420, fair_cat: 1, real_cat: -26 },
	"344_637": { name: "Pomegranate Jelly", price: 330, fair_cat: 1, real_cat: -26 },
	"348_396": { name: "Spice Berry Wine", price: 240, fair_cat: 1, real_cat: -26 },
	"344_396": { name: "Spice Berry Jelly", price: 210, fair_cat: 1, real_cat: -26 },
	"340_597": { name: "Blue Jazz Honey", price: 200, fair_cat: 1, real_cat: -26 },
	"340_593": { name: "Summer Spangle Honey", price: 280, fair_cat: 1, real_cat: -26 },
	"348_638": { name: "Cherry Wine", price: 240, fair_cat: 1, real_cat: -26 },
	"344_638": { name: "Cherry Jelly", price: 210, fair_cat: 1, real_cat: -26 },
	"348_90": { name: "Cactus Fruit Wine", price: 225, fair_cat: 1, real_cat: -26 },
	"344_90": { name: "Cactus Fruit Jelly", price: 200, fair_cat: 1, real_cat: -26 },
	"342_256": { name: "Pickled Tomato", price: 180, fair_cat: 1, real_cat: -26 },
	"350_256": { name: "Tomato Juice", price: 170, fair_cat: 1, real_cat: -26 },
	"342_24": { name: "Pickled Parsnip", price: 105, fair_cat: 1, real_cat: -26 },
	"350_24": { name: "Parsnip Juice", price: 120, fair_cat: 1, real_cat: -26 },
	"340_591": { name: "Tulip Honey", price: 160, fair_cat: 1, real_cat: -26 },
	"348_636": { name: "Peach Wine", price: 420, fair_cat: 1, real_cat: -26 },
	"344_636": { name: "Peach Jelly", price: 330, fair_cat: 1, real_cat: -26 },
	"340_376": { name: "Poppy Honey", price: 380, fair_cat: 1, real_cat: -26 },
	"348_410": { name: "Blackberry Wine", price: 60, fair_cat: 1, real_cat: -26 },
	"344_410": { name: "Blackberry Jelly", price: 90, fair_cat: 1, real_cat: -26 },
	"342_276": { name: "Pickled Pumpkin", price: 960, fair_cat: 1, real_cat: -26 },
	"350_276": { name: "Pumpkin Juice", price: 690, fair_cat: 1, real_cat: -26 },
	"342_270": { name: "Pickled Corn", price: 150, fair_cat: 1, real_cat: -26 },
	"350_270": { name: "Corn Juice", price: 150, fair_cat: 1, real_cat: -26 },
	"348_634": { name: "Apricot Wine", price: 150, fair_cat: 1, real_cat: -26 },
	"344_634": { name: "Apricot Jelly", price: 150, fair_cat: 1, real_cat: -26 },
	"342_264": { name: "Pickled Radish", price: 270, fair_cat: 1, real_cat: -26 },
	"350_264": { name: "Radish Juice", price: 230, fair_cat: 1, real_cat: -26 },
	"342_259": { name: "Pickled Fiddlehead Fern", price: 270, fair_cat: 1, real_cat: -26 },
	"350_259": { name: "Fiddlehead Fern Juice", price: 230, fair_cat: 1, real_cat: -26 },
	"348_254": { name: "Melon Wine", price: 750, fair_cat: 1, real_cat: -26 },
	"344_254": { name: "Melon Jelly", price: 550, fair_cat: 1, real_cat: -26 },
	"348_406": { name: "Wild Plum Wine", price: 240, fair_cat: 1, real_cat: -26 },
	"344_406": { name: "Wild Plum Jelly", price: 210, fair_cat: 1, real_cat: -26 },
	"348_260": { name: "Hot Pepper Wine", price: 120, fair_cat: 1, real_cat: -26 },
	"344_260": { name: "Hot Pepper Jelly", price: 130, fair_cat: 1, real_cat: -26 },
	"348_635": { name: "Orange Wine", price: 300, fair_cat: 1, real_cat: -26 },
	"344_635": { name: "Orange Jelly", price: 250, fair_cat: 1, real_cat: -26 },
	"342_284": { name: "Pickled Beet", price: 300, fair_cat: 1, real_cat: -26 },
	"350_284": { name: "Beet Juice", price: 250, fair_cat: 1, real_cat: -26 },
	"348_613": { name: "Apple Wine", price: 300, fair_cat: 1, real_cat: -26 },
	"344_613": { name: "Apple Jelly", price: 250, fair_cat: 1, real_cat: -26 },
	"342_262": { name: "Pickled Wheat", price: 75, fair_cat: 1, real_cat: -26 },
	"342_274": { name: "Pickled Artichoke", price: 480, fair_cat: 1, real_cat: -26 },
	"350_274": { name: "Artichoke Juice", price: 370, fair_cat: 1, real_cat: -26 },
	"348_400": { name: "Strawberry Wine", price: 360, fair_cat: 1, real_cat: -26 },
	"344_400": { name: "Strawberry Jelly", price: 290, fair_cat: 1, real_cat: -26 },
	"342_248": { name: "Pickled Garlic", price: 180, fair_cat: 1, real_cat: -26 },
	"350_248": { name: "Garlic Juice", price: 170, fair_cat: 1, real_cat: -26 },
	"342_272": { name: "Pickled Eggplant", price: 180, fair_cat: 1, real_cat: -26 },
	"350_272": { name: "Eggplant Juice", price: 170, fair_cat: 1, real_cat: -26 },
	"348_398": { name: "Grape Wine", price: 240, fair_cat: 1, real_cat: -26 },
	"344_398": { name: "Grape Jelly", price: 210, fair_cat: 1, real_cat: -26 },
	"348_414": { name: "Crystal Fruit Wine", price: 450, fair_cat: 1, real_cat: -26 },
	"344_414": { name: "Crystal Fruit Jelly", price: 350, fair_cat: 1, real_cat: -26 },
	"342_266": { name: "Pickled Red Cabbage", price: 780, fair_cat: 1, real_cat: -26 },
	"350_266": { name: "Red Cabbage Juice", price: 570, fair_cat: 1, real_cat: -26 },
	};
