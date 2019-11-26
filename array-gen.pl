#! perl
#
# array-gen.pl
#
# Utility script to create javascript arrays from raw ObjectInformation data (yaml)
# https://mouseypounds.github.io/stardew-fair-helper

use strict;
use POSIX qw(floor);

my @cat = (
	"Animal Prod.",			# 0
	"Artisan Goods",		# 1
	"Cooked Items",			# 2
	"Fish",					# 3
	"Forage/Flowers",		# 4
	"Fruits",				# 5
	"Gems/Minerals",		# 6
	"Vegetables",			# 7
	"(No Category)",		# 8
	);
my %cat_items = ();

# Filtering out stuff. I'm including rings too (516-534) even though those might be usable
# We also filter out the Lucky Purple Shorts (789)
my @invalid = (0,2,4,75,76,77,79,102,290,294,295,313,314,315,316,317,318,319,320,321,326,343,449,450,452,461,
	516,517,518,519,520,521,522,523,524,525,526,527,528,529,530,531,532,533,534,
	590,668,670,674,675,676,677,678,679,747,748,750,751,760,762,764,765,766,784,785,786,789,792,793,794,
	);
my %invalid = ();

# We need 2 data structures:
#  * a general hash for looking up things like prices & categories
#  * a grouped list of names for populating the form select elements
# Some info can be gathered as we parse the raw data, but a second or third pass will be
# necessary for other stuff. That's a big reason this is all pre-assembled and hardcoded into
# the actual javascript later.

my @js_lookup = ();
my %js_group = ();
my %pl_lookup = ();
my %flowers = ();

foreach my $id (@invalid) {
	$invalid{$id} = 1;
}

while (<DATA>) {
	/^\s+"(\d+)":\s+"(.*)",?\s?$/;
	my $id = $1;
	next if (exists $invalid{$id});
	my @field = split('/', $2);
	my $name = $field[0];
	$name =~ s/'/\\'/g;
	my $price = 0 + $field[1];
	my @temp = split(' ', $field[3]);
	my $type = $temp[0];
	my $raw_cat = 0;
	if (scalar @temp > 1) {
		$raw_cat = $temp[1];
	}
	my $category = 8;
	if ($raw_cat == -18 or $raw_cat == -14 or $raw_cat == -6 or $raw_cat == -5) {
		$category = 0;
	} elsif ($raw_cat == -26) {
		$category = 1;
	} elsif ($raw_cat == -7) {
		$category = 2;
	} elsif ($raw_cat == -4) {
		$category = 3;
	} elsif ($raw_cat == -81 or $raw_cat == -80 or $raw_cat == -27) {
		$category = 4;
	} elsif ($raw_cat == -79) {
		$category = 5;
	} elsif ($raw_cat == -12 or $raw_cat == -2) {
		$category = 6;
	} elsif ($raw_cat == -75) {
		$category = 7;
	}

	# Adding color differentiation for some items and clarification on some artisan goods
	# Generic roe & aged roe shouldn't technically be possible, but we are including them
	if ($id == 174 or $id == 176) {
		$name .= " (White)";
	} elsif ($id == 180 or $id == 182) {
		$name .= " (Brown)";
	} elsif ($id == 126) {
		$name .= " (Green)";
	} elsif ($id == 127) {
		$name .= " (Yellow)";
	} elsif ($id == 340) {
		$name = "Wild Honey";
	} elsif ($id == 342 or $id == 344 or $id == 348 or $id == 350 or $id == 447 or $id == 812) {
		$name .= " (Generic)";
	}
	
	push @js_lookup, qq(\t$id: { name: "$name", price: $price, fair_cat: $category, real_cat: $raw_cat },\n);
	$pl_lookup{$id} = { 'name' => $name, 'price' => $price, 'category' => $category};
	# we need this for honey later
	if ($raw_cat == -80) {
		$flowers{$id} = 1;
	}

	if (not exists $cat_items{$category}) {
		$cat_items{$category} = [];
	}
	push @{$cat_items{$category}}, $id;

	#print "$id $name $price $raw_cat $category\n";
}

# Second parse for specific artisan goods. lots of hardcoding
foreach my $k (keys %pl_lookup) {
	if ($pl_lookup{$k}{'category'} == 5) { #fruit
		# wine
		my $id = "348_$k";
		my $price = $pl_lookup{$k}{'price'} * 3;
		my $name = $pl_lookup{$k}{'name'} . " Wine";
		$pl_lookup{$id} = { 'name' => $name, 'price' => $price, 'category' => 1 };
		push @{$cat_items{1}}, $id;
		push @js_lookup, qq(\t"$id": { name: "$name", price: $price, fair_cat: 1, real_cat: -26 },\n);
		# jelly
		$id  = "344_$k";
		$price = $pl_lookup{$k}{'price'} * 2 + 50;
		$name = $pl_lookup{$k}{'name'} . " Jelly";
		$pl_lookup{$id} = { 'name' => $name, 'price' => $price, 'category' => 1 };
		push @{$cat_items{1}}, $id;
		push @js_lookup, qq(\t"$id": { name: "$name", price: $price, fair_cat: 1, real_cat: -26 },\n);
	} elsif ($pl_lookup{$k}{'category'} == 7) { #veg
		# pickles
		my $id = "342_$k";
		my $price = $pl_lookup{$k}{'price'} * 3;
		my $name = "Pickled " . $pl_lookup{$k}{'name'};
		$pl_lookup{$id} = { 'name' => $name, 'price' => $price, 'category' => 1 };
		push @{$cat_items{1}}, $id;
		push @js_lookup, qq(\t"$id": { name: "$name", price: $price, fair_cat: 1, real_cat: -26 },\n);
		# juice; skipping wheat and hops
		next if ($k == 304 or $k == 262);
		$id  = "350_$k";
		$price = $pl_lookup{$k}{'price'} * 2 + 50;
		$name = $pl_lookup{$k}{'name'} . " Juice";
		$pl_lookup{$id} = { 'name' => $name, 'price' => $price, 'category' => 1 };
		push @{$cat_items{1}}, $id;
		push @js_lookup, qq(\t"$id": { name: "$name", price: $price, fair_cat: 1, real_cat: -26 },\n);
	} elsif ($pl_lookup{$k}{'category'} == 3) { #fish
		# skip the algae types & legendary fish since base game doesn't support them in ponds
		next if ($k == 152 or $k == 153 or $k == 157 or $k == 159 or $k == 160 or $k == 163 or $k == 682 or $k == 775);
		# roe (not an artisan good)
		my $id = "812_$k";
		my $price = $pl_lookup{812}{'price'} + floor($pl_lookup{$k}{'price'} / 2);
		my $name = $pl_lookup{$k}{'name'} . " Roe";
		$pl_lookup{$id} = { 'name' => $name, 'price' => $price, 'category' => 8 };
		push @{$cat_items{8}}, $id;
		push @js_lookup, qq(\t"$id": { name: "$name", price: $price, fair_cat: 8, real_cat: -23 },\n);
		# aged roe, skipping sturgeon
		next if ($k == 698);
		$id  = "447_$k";
		$price *= 2; # doubles base roe price
		$name = "Aged " . $pl_lookup{$k}{'name'} . " Roe";
		$pl_lookup{$id} = { 'name' => $name, 'price' => $price, 'category' => 1 };
		push @{$cat_items{1}}, $id;
		push @js_lookup, qq(\t"$id": { name: "$name", price: $price, fair_cat: 1, real_cat: -26 },\n);
	} elsif (exists $flowers{$k}) {
		# honey is no longer hardcoded in 1.4 and we're using a helper function to identify them
		# in theory, any flower is supported, although some of these may be impossible to create
		my $id = "340_$k";
		my $price = $pl_lookup{$k}{'price'} * 2 + 100;
		my $name = $pl_lookup{$k}{'name'} . " Honey";
		$pl_lookup{$id} = { 'name' => $name, 'price' => $price, 'category' => 1 };
		push @{$cat_items{1}}, $id;
		push @js_lookup, qq(\t"$id": { name: "$name", price: $price, fair_cat: 1, real_cat: -26 },\n);
	}
}

print "cat_name = [\n";
foreach my $cn (@cat) {
	print "\t'$cn',\n";
}
print "\t];\n";

print "obj_info = {\n";
print qq(\t'none': { name: "(No Item)", price: 0, fair_cat: 8, real_cat: 0 },\n);
foreach my $j (@js_lookup) {
	print "$j";
}
print "\t};\n";

print "\t\tvar data = [\n";
print qq(\t\t\t{ id: 'none', text: '(No Item)' },\n);
for (my $c = 0; $c < 9; $c++) {
	my $cid = "cat_" . $c;
	print "\t\t\t{ id: '$cid', text: '$cat[$c]', children: [\n";
	foreach my $i ( sort {$pl_lookup{$a}{'name'} cmp $pl_lookup{$b}{'name'} } @{$cat_items{$c}}) {
		my $id = $i;
		if ($id =~ /_/) {
			$id = qq("$i");
		}
		print "\t\t\t\t{ id: $id, text:'$pl_lookup{$i}{q(name)}' },\n";
	}
	print "\t\t\t]},\n";
}
print "\t\t\t];\n";


# Object Info dump from game (json)
# Field list: 0:Name / 1:Price / 2:Edibility / 3:Type & Category / 4:Display Name / 5:Description / ...
__DATA__
  "0": "Weeds/0/-1/Basic/Weeds/A bunch of obnoxious weeds.",
  "2": "Stone/0/-300/Basic/Stone/A useful material when broken with the Pickaxe.",
  "4": "Stone/0/-300/Basic/Stone/A useful material when chopped with the axe.",
  "16": "Wild Horseradish/50/5/Basic -81/Wild Horseradish/A spicy root found in the spring.",
  "18": "Daffodil/30/0/Basic -81/Daffodil/A traditional spring flower that makes a nice gift.",
  "20": "Leek/60/16/Basic -81/Leek/A tasty relative of the onion.",
  "22": "Dandelion/40/10/Basic -81/Dandelion/Not the prettiest flower, but the leaves make a good salad.",
  "24": "Parsnip/35/10/Basic -75/Parsnip/A spring tuber closely related to the carrot. It has an earthy taste and is full of nutrients.",
  "30": "Lumber/2/10/Basic/Lumber/A versatile resource used for building and fuel.",
  "60": "Emerald/250/-300/Minerals -2/Emerald/A precious stone with a brilliant green color.",
  "62": "Aquamarine/180/-300/Minerals -2/Aquamarine/A shimmery blue-green gem.",
  "64": "Ruby/250/-300/Minerals -2/Ruby/A precious stone that is sought after for its rich color and beautiful luster.",
  "66": "Amethyst/100/-300/Minerals -2/Amethyst/A purple variant of quartz.",
  "68": "Topaz/80/-300/Minerals -2/Topaz/Fairly common but still prized for its beauty.",
  "70": "Jade/200/-300/Minerals -2/Jade/A pale green ornamental stone.",
  "71": "Trimmed Lucky Purple Shorts/0/-300/Quest/Trimmed Lucky Purple Shorts/Purple silk shorts trimmed in luxurious gold...",
  "72": "Diamond/750/-300/Minerals -2/Diamond/A rare and valuable gem.",
  "74": "Prismatic Shard/2000/-300/Minerals -2/Prismatic Shard/A very rare and powerful substance with unknown origins.",
  "75": "Stone/50/-300/Basic/Stone/...",
  "76": "Stone/50/-300/Basic/Stone/...",
  "77": "Stone/50/-300/Basic/Stone/...",
  "78": "Cave Carrot/25/12/Basic -81/Cave Carrot/A starchy snack found in caves. It helps miners work longer.",
  "79": "Secret Note/1/-300/asdf/Secret Note/It's old and crumpled, but if you look closely you can make out the details.../Town .0001/Note",
  "80": "Quartz/25/-300/Minerals -2/Quartz/A clear crystal commonly found in caves and mines.",
  "82": "Fire Quartz/100/-300/Minerals -2/Fire Quartz/A glowing red crystal commonly found near hot lava.",
  "84": "Frozen Tear/75/-300/Minerals -2/Frozen Tear/A crystal fabled to be the frozen tears of a yeti.",
  "86": "Earth Crystal/50/-300/Minerals -2/Earth Crystal/A resinous substance found near the surface.",
  "88": "Coconut/100/-300/Basic -79/Coconut/A seed of the coconut palm. It has many culinary uses.",
  "90": "Cactus Fruit/75/30/Basic -79/Cactus Fruit/The sweet fruit of the prickly pear cactus.",
  "92": "Sap/2/-1/Basic -81/Sap/A fluid obtained from trees.",
  "93": "Torch/5/-300/Crafting/Torch/Provides a modest amount of light.",
  "94": "Spirit Torch/5/-300/Crafting/Spirit Torch/It's unclear where the blue color comes from...",
  "96": "Dwarf Scroll I/1/-300/Arch/Dwarf Scroll I/A yellowed scroll of parchment filled with dwarven script. This one's tied with a red bow.//Set Dwarf 96 97 98 99",
  "97": "Dwarf Scroll II/1/-300/Arch/Dwarf Scroll II/A yellowed scroll of parchment filled with dwarven script. This one's tied with a green ribbon.//Set Dwarf 96 97 98 99",
  "98": "Dwarf Scroll III/1/-300/Arch/Dwarf Scroll III/A yellowed scroll of parchment filled with dwarven script. This one's tied with a blue rope.//Set Dwarf 96 97 98 99",
  "99": "Dwarf Scroll IV/1/-300/Arch/Dwarf Scroll IV/A yellowed scroll of parchment filled with dwarven script. This one's tied with a golden chain.//Set Dwarf 96 97 98 99",
  "100": "Chipped Amphora/40/-300/Arch/Chipped Amphora/An ancient vessel made of ceramic material. Used to transport both dry and wet goods./Town .04/Item 3 461",
  "101": "Arrowhead/40/-300/Arch/Arrowhead/A crudely fashioned point used for hunting./Mountain .02 Forest .02 BusStop .02/Debris 2 30 14",
  "102": "Lost Book/50/-300/asdf/Lost Book/Writings from a wide variety of time periods./Town .05/Note",
  "103": "Ancient Doll/60/-300/Arch/Ancient Doll/An ancient doll covered in grime. This doll may have been used as a toy, a decoration, or a prop in some kind of ritual./Mountain .04 Forest .03 BusStop .03 Town .01/Money 1 250",
  "104": "Elvish Jewelry/200/-300/Arch/Elvish Jewelry/Dirty but still beautiful. On the side is a flowing script thought by some to be the ancient language of the elves. No Elvish bones have ever been found./Forest .01/Debris 1 20 6",
  "105": "Chewing Stick/50/-300/Arch/Chewing Stick/Ancient people chewed on these to keep their teeth clean./Mountain .02 Town .01 Forest .02/Decor 10 28",
  "106": "Ornamental Fan/300/-300/Arch/Ornamental Fan/This exquisute fan most likely belonged to a noblewoman. Historians believe that the valley was a popular sixth-era vacation spot for the wealthy./Beach .02 Town .008 Forest .01/Money 1 300",
  "107": "Dinosaur Egg/350/-300/Arch/Dinosaur Egg/A giant dino egg... The entire shell is still intact!/Mine .01 Mountain .008/Item 1 107",
  "108": "Rare Disc/300/-300/Arch/Rare Disc/A heavy black disc studded with peculiar red stones. When you hold it, you're overwhelmed with a feeling of dread./UndergroundMine .01/Decor 1 29",
  "109": "Ancient Sword/100/-300/Arch/Ancient Sword/It's the remains of an ancient sword. Most of the blade has turned to rust, but the hilt is very finely crafted./Forest .01 Mountain .008/Debris 1 30 2",
  "110": "Rusty Spoon/25/-300/Arch/Rusty Spoon/A plain old spoon, probably ten years old. Not very interesting./Town .05/Debris 5 30 2",
  "111": "Rusty Spur/25/-300/Arch/Rusty Spur/An old spur that was once attached to a cowboy's boot. People must have been raising animals in this area for many generations./Farm .1/Money 1 100",
  "112": "Rusty Cog/25/-300/Arch/Rusty Cog/A well preserved cog that must have been part of some ancient machine. This could be dwarven technology./Mountain .05/Debris 1 20 4",
  "113": "Chicken Statue/50/-300/Arch/Chicken Statue/It's a statue of a chicken on a bronze base. The ancient people of this area must have been very fond of chickens./Farm .1/Decor 5 31",
  "114": "Ancient Seed/5/-300/Arch/Ancient Seed/It's a dry old seed from some ancient plant. By all appearances it's long since dead.../Forest .01 Mountain .01/Seeds 9",
  "115": "Prehistoric Tool/50/-300/Arch/Prehistoric Tool/Some kind of gnarly old digging tool./Mountain .03 Forest .03 BusStop .04/Debris 1 30 12",
  "116": "Dried Starfish/40/-300/Arch/Dried Starfish/A starfish from the primordial ocean. It's an unusually pristine specimen!/Beach .1/Money 1 200",
  "117": "Anchor/100/-300/Arch/Anchor/It may have belonged to ancient pirates./Beach .05/Item 1 289",
  "118": "Glass Shards/20/-300/Arch/Glass Shards/A mixture of glass shards smoothed by centuries of ocean surf. These could have belonged to an ancient mosaic or necklace./Beach .1/Item 1 462",
  "119": "Bone Flute/100/-300/Arch/Bone Flute/It's a prehistoric wind instrument carved from an animal's bone. It produces an eerie tone./Mountain .01 Forest .01 UndergroundMine .02 Town .005/Recipe 2 Flute_Block 150",
  "120": "Prehistoric Handaxe/50/-300/Arch/Prehistoric Handaxe/One of the earliest tools employed by humans. This \"crude\" tool was created by striking one rock with another to form a sharp edge./Mountain .05 Forest .05 BusStop .05/Item 1 294",
  "121": "Dwarvish Helm/100/-300/Arch/Dwarvish Helm/It's one of the helmets commonly worn by dwarves. The thick metal plating protects them from falling debris and stalactites./UndergroundMine .01/Debris 1 50 0",
  "122": "Dwarf Gadget/200/-300/Arch/Dwarf Gadget/It's a piece of the advanced technology once known to the dwarves. It's still glowing and humming, but you're unable to understand how it works./UndergroundMine .001/Money 1 500",
  "123": "Ancient Drum/100/-300/Arch/Ancient Drum/It's a drum made from wood and animal skin. It has a low, reverberating tone./BusStop .01 Forest .01 UndergroundMine .02 Town .005/Recipe 2 Drum_Block 300",
  "124": "Golden Mask/500/-300/Arch/Golden Mask/A creepy golden mask probably used in an ancient magic ritual. A socket in the forehead contains a large purple gemstone./Desert .04/Money 1 1000",
  "125": "Golden Relic/250/-300/Arch/Golden Relic/It's a golden slab with heiroglyphs and pictures emblazoned onto the front./Desert .08/Debris 1 40 6",
  "126": "Strange Doll/1000/-300/Arch/Strange Doll/???/Farm .001 Town .001 Mountain .001 Forest .001 BusStop .001 Beach .001 UndergroundMine .001/Item 1 126",
  "127": "Strange Doll/1000/-300/Arch/Strange Doll/???/Farm .001 Town .001 Mountain .001 Forest .001 BusStop .001 Beach .001 UndergroundMine .001/Item 1 127",
  "128": "Pufferfish/200/-40/Fish -4/Pufferfish/Inflates when threatened./Day^Summer",
  "129": "Anchovy/30/5/Fish -4/Anchovy/A small silver fish found in the ocean./Day Night^Spring Fall",
  "130": "Tuna/100/15/Fish -4/Tuna/A large fish that lives in the ocean./Day^Summer Winter",
  "131": "Sardine/40/5/Fish -4/Sardine/A common ocean fish./Day^Spring Summer Fall Winter",
  "132": "Bream/45/5/Fish -4/Bream/A fairly common river fish that becomes active at night./Night^Spring Summer Fall Winter",
  "136": "Largemouth Bass/100/15/Fish -4/Largemouth Bass/A popular fish that lives in lakes./Day^Spring Summer Fall Winter",
  "137": "Smallmouth Bass/50/10/Fish -4/Smallmouth Bass/A freshwater fish that is very sensitive to pollution./Day Night^Spring Fall",
  "138": "Rainbow Trout/65/10/Fish -4/Rainbow Trout/A freshwater trout with colorful markings./Day^Summer",
  "139": "Salmon/75/15/Fish -4/Salmon/Swims upstream to lay its eggs./Day^Fall",
  "140": "Walleye/105/12/Fish -4/Walleye/A freshwater fish caught at night./Night^Fall Winter",
  "141": "Perch/55/10/Fish -4/Perch/A freshwater fish of the winter./Day Night^Winter",
  "142": "Carp/30/5/Fish -4/Carp/A common pond fish./Day Night^Spring Summer Fall",
  "143": "Catfish/200/20/Fish -4/Catfish/An uncommon fish found in streams./Day^Spring Fall Winter",
  "144": "Pike/100/15/Fish -4/Pike/A freshwater fish that's difficult to catch./Day Night^Summer Winter",
  "145": "Sunfish/30/5/Fish -4/Sunfish/A common river fish./Day^Spring Summer",
  "146": "Red Mullet/75/10/Fish -4/Red Mullet/Long ago these were kept as pets./Day^Summer Winter",
  "147": "Herring/30/5/Fish -4/Herring/A common ocean fish./Day Night^Spring Winter",
  "148": "Eel/85/12/Fish -4/Eel/A long, slippery little fish./Night^Spring Fall",
  "149": "Octopus/150/-300/Fish -4/Octopus/A mysterious and intelligent creature./Day^Summer",
  "150": "Red Snapper/50/10/Fish -4/Red Snapper/A popular fish with a nice red color./Day^Summer Fall Winter",
  "151": "Squid/80/10/Fish -4/Squid/A deep sea creature that can grow to enormous size./Day^Winter",
  "152": "Seaweed/20/5/Fish/Seaweed/It can be used in cooking./Day Night^Spring Summer Fall Winter",
  "153": "Green Algae/15/5/Fish/Green Algae/It's really slimy./Day Night^Spring Summer Fall Winter",
  "154": "Sea Cucumber/75/-10/Fish -4/Sea Cucumber/A slippery, slimy creature found on the ocean floor./Day^Fall Winter",
  "155": "Super Cucumber/250/50/Fish -4/Super Cucumber/A rare, purple variety of sea cucumber./Night^Summer Fall",
  "156": "Ghostfish/45/15/Fish -4/Ghostfish/A pale, blind fish found in underground lakes./Day Night^Spring Summer Fall Winter",
  "157": "White Algae/25/8/Fish/White Algae/It's super slimy./Day Night^Spring Summer Fall Winter",
  "158": "Stonefish/300/-300/Fish -4/Stonefish/A bizarre fish that's shaped like a brick./Day Night^Spring Summer Fall Winter",
  "159": "Crimsonfish/1500/15/Fish -4/Crimsonfish/Lives deep in the ocean but likes to lay its eggs in the warm summer water./Day^Winter",
  "160": "Angler/900/10/Fish -4/Angler/Uses a bioluminescent dangler to attract prey./Day Night^Spring Summer Fall Winter",
  "161": "Ice Pip/500/15/Fish -4/Ice Pip/A rare fish that thrives in extremely cold conditions./Day Night^Spring Summer Fall Winter",
  "162": "Lava Eel/700/20/Fish -4/Lava Eel/It can somehow survive in pools of red-hot lava./Day Night^Spring Summer Fall Winter",
  "163": "Legend/5000/200/Fish -4/Legend/The king of all fish! They said he'd never be caught./Day^Winter",
  "164": "Sandfish/75/5/Fish -4/Sandfish/It tries to hide using camouflage./Day Night^Spring Summer Fall Winter",
  "165": "Scorpion Carp/150/-50/Fish -4/Scorpion Carp/It's like a regular carp but with a sharp stinger./Day Night^Spring Summer Fall Winter",
  "166": "Treasure Chest/5000/-300/Basic/Treasure Chest/Wow, it's loaded with treasure! This is sure to fetch a good price./Day Night^Spring Summer Fall Winter",
  "167": "Joja Cola/25/5/Fish -20/Joja Cola/The flagship product of Joja corporation./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "168": "Trash/0/-300/Fish -20/Trash/It's junk./Day Night^Spring Summer Fall Winter",
  "169": "Driftwood/0/-300/Fish -20/Driftwood/A piece of wood from the sea./Day Night^Spring Summer Fall Winter",
  "170": "Broken Glasses/0/-300/Fish -20/Broken Glasses/It looks like someone lost their glasses. They're busted./Day Night^Spring Summer Fall Winter",
  "171": "Broken CD/0/-300/Fish -20/Broken CD/It's a JojaNet 2.0 trial CD. They must've made a billion of these things./Day Night^Spring Summer Fall Winter",
  "172": "Soggy Newspaper/0/-300/Fish -20/Soggy Newspaper/This is trash./Day Night^Spring Summer Fall Winter",
  "176": "Egg/50/10/Basic -5/Egg/A regular white chicken egg.",
  "174": "Large Egg/95/15/Basic -5/Large Egg/It's an uncommonly large white egg!",
  "178": "Hay/0/-300/Basic/Hay/Dried grass used as animal food.",
  "180": "Egg/50/10/Basic -5/Egg/A regular brown chicken egg.",
  "182": "Large Egg/95/15/Basic -5/Large Egg/It's an uncommonly large brown egg!",
  "184": "Milk/125/15/Basic -6/Milk/A jug of cow's milk./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "186": "Large Milk/190/20/Basic -6/Large Milk/A large jug of cow's milk./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "188": "Green Bean/40/10/Basic -75/Green Bean/A juicy little bean with a cool, crisp snap.",
  "190": "Cauliflower/175/30/Basic -75/Cauliflower/Valuable, but slow-growing. Despite its pale color, the florets are packed with nutrients.",
  "191": "Ornate Necklace/0/-300/Quest/Ornate Necklace/A fancy necklace found in the water outside of the bath house. It's still wet...",
  "192": "Potato/80/10/Basic -75/Potato/A widely cultivated tuber.",
  "194": "Fried Egg/35/20/Cooking -7/Fried Egg/Sunny-side up./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "195": "Omelet/125/40/Cooking -7/Omelet/It's super fluffy./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "196": "Salad/110/45/Cooking -7/Salad/A healthy garden salad./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "197": "Cheese Cauliflower/300/55/Cooking -7/Cheese Cauliflower/It smells great!/food/0 0 0 0 0 0 0 0 0 0 0/0",
  "198": "Baked Fish/100/30/Cooking -7/Baked Fish/Baked fish on a bed of herbs./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "199": "Parsnip Soup/120/34/Cooking -7/Parsnip Soup/It's fresh and hearty./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "200": "Vegetable Medley/120/66/Cooking -7/Vegetable Medley/This is very nutritious./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "201": "Complete Breakfast/350/80/Cooking -7/Complete Breakfast/You'll feel ready to take on the world!/food/2 0 0 0 0 0 0 50 0 0 0/600",
  "202": "Fried Calamari/150/32/Cooking -7/Fried Calamari/It's so chewy./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "203": "Strange Bun/225/40/Cooking -7/Strange Bun/What's inside?/food/0 0 0 0 0 0 0 0 0 0 0/0",
  "204": "Lucky Lunch/250/40/Cooking -7/Lucky Lunch/A special little meal./food/0 0 0 0 3 0 0 0 0 0 0/960",
  "205": "Fried Mushroom/200/54/Cooking -7/Fried Mushroom/Earthy and aromatic./food/0 0 0 0 0 0 0 0 0 0 0 2/600",
  "206": "Pizza/300/60/Cooking -7/Pizza/It's popular for all the right reasons./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "207": "Bean Hotpot/100/50/Cooking -7/Bean Hotpot/It sure is healthy./food/0 0 0 0 0 0 0 30 32 0 0/600",
  "208": "Glazed Yams/200/80/Cooking -7/Glazed Yams/Sweet and satisfying... The sugar gives it a hint of caramel./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "209": "Carp Surprise/150/36/Cooking -7/Carp Surprise/It's bland and oily./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "210": "Hashbrowns/120/36/Cooking -7/Hashbrowns/Crispy and golden-brown!/food/1 0 0 0 0 0 0 0 0 0 0/480",
  "211": "Pancakes/80/36/Cooking -7/Pancakes/A double stack of fluffy, soft pancakes./food/0 0 0 0 0 2 0 0 0 0 0/960",
  "212": "Salmon Dinner/300/50/Cooking -7/Salmon Dinner/The lemon spritz makes it special./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "213": "Fish Taco/500/66/Cooking -7/Fish Taco/It smells delicious./food/0 2 0 0 0 0 0 0 0 0 0/600",
  "214": "Crispy Bass/150/36/Cooking -7/Crispy Bass/Wow, the breading is perfect./food/0 0 0 0 0 0 0 0 64 0 0/600",
  "215": "Pepper Poppers/200/52/Cooking -7/Pepper Poppers/Spicy breaded peppers filled with cheese./food/2 0 0 0 0 0 0 0 0 1 0/600",
  "216": "Bread/60/20/Cooking -7/Bread/A crusty baguette./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "218": "Tom Kha Soup/250/70/Cooking -7/Tom Kha Soup/These flavors are incredible!/food/2 0 0 0 0 0 0 30 0 0 0/600",
  "219": "Trout Soup/100/40/Cooking -7/Trout Soup/Pretty salty./food/0 1 0 0 0 0 0 0 0 0 0/400",
  "220": "Chocolate Cake/200/60/Cooking -7/Chocolate Cake/Rich and moist with a thick fudge icing./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "221": "Pink Cake/480/100/Cooking -7/Pink Cake/There's little heart candies on top./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "222": "Rhubarb Pie/400/86/Cooking -7/Rhubarb Pie/Mmm, tangy and sweet!/food/0 0 0 0 0 0 0 0 0 0 0/0",
  "223": "Cookie/140/36/Cooking -7/Cookie/Very chewy./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "224": "Spaghetti/120/30/Cooking -7/Spaghetti/An old favorite./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "225": "Fried Eel/120/30/Cooking -7/Fried Eel/Greasy but flavorful./food/0 0 0 0 1 0 0 0 0 0 0/600",
  "226": "Spicy Eel/175/46/Cooking -7/Spicy Eel/It's really spicy! Be careful./food/0 0 0 0 1 0 0 0 0 1 0/600",
  "227": "Sashimi/75/30/Cooking -7/Sashimi/Raw fish sliced into thin pieces./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "228": "Maki Roll/220/40/Cooking -7/Maki Roll/Fish and rice wrapped in seaweed./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "229": "Tortilla/50/20/Cooking -7/Tortilla/Can be used as a vessel for food or eaten by itself./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "230": "Red Plate/400/96/Cooking -7/Red Plate/Full of antioxidants./food/0 0 0 0 0 0 0 50 0 0 0/300",
  "231": "Eggplant Parmesan/200/70/Cooking -7/Eggplant Parmesan/Tangy, cheesy, and wonderful./food/0 0 1 0 0 0 0 0 0 0 3/400",
  "232": "Rice Pudding/260/46/Cooking -7/Rice Pudding/It's creamy, sweet, and fun to eat./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "233": "Ice Cream/120/40/Cooking -7/Ice Cream/It's hard to find someone who doesn't like this./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "234": "Blueberry Tart/150/50/Cooking -7/Blueberry Tart/It's subtle and refreshing./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "235": "Autumn's Bounty/350/88/Cooking -7/Autumn's Bounty/A taste of the season./food/0 0 0 0 0 2 0 0 0 0 2/660",
  "236": "Pumpkin Soup/300/80/Cooking -7/Pumpkin Soup/A seasonal favorite./food/0 0 0 0 2 0 0 0 0 0 2/660",
  "237": "Super Meal/220/64/Cooking -7/Super Meal/It's a really energizing meal./food/0 0 0 0 0 0 0 40 0 1 0/300",
  "238": "Cranberry Sauce/120/50/Cooking -7/Cranberry Sauce/A festive treat./food/0 0 2 0 0 0 0 0 0 0 0/300",
  "239": "Stuffing/165/68/Cooking -7/Stuffing/Ahh... the smell of warm bread and sage./food/0 0 0 0 0 0 0 0 0 0 2/480",
  "240": "Farmer's Lunch/150/80/Cooking -7/Farmer's Lunch/This'll keep you going./food/3 0 0 0 0 0 0 0 0 0 0/480",
  "241": "Survival Burger/180/50/Cooking -7/Survival Burger/A convenient snack for the explorer./food/0 0 0 0 0 3 0 0 0 0 0/480",
  "242": "Dish O' The Sea/220/60/Cooking -7/Dish O' The Sea/This'll keep you warm in the cold sea air./food/0 3 0 0 0 0 0 0 0 0 0/480",
  "243": "Miner's Treat/200/50/Cooking -7/Miner's Treat/This should keep your energy up./food/0 0 3 0 0 0 0 0 32 0 0/480",
  "244": "Roots Platter/100/50/Cooking -7/Roots Platter/This'll get you digging for more./food/0 0 0 0 0 0 0 0 0 0 0 3/480",
  "245": "Sugar/50/10/Basic/Sugar/Adds sweetness to pastries and candies. Too much can be unhealthy.",
  "246": "Wheat Flour/50/5/Basic/Wheat Flour/A common cooking ingredient made from crushed wheat seeds.",
  "247": "Oil/100/5/Basic/Oil/All purpose cooking oil./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "248": "Garlic/60/8/Basic -75/Garlic/Adds a wonderful zestiness to dishes. High quality garlic can be pretty spicy.",
  "250": "Kale/110/20/Basic -75/Kale/The waxy leaves are great in soups and stir frys.",
  "251": "Tea Sapling/500/-300/Basic -74/Tea Sapling/Takes 20 days to mature. Produces tea leaves during the final week of each season, except winter. No watering necessary!",
  "252": "Rhubarb/220/-300/Basic -79/Rhubarb/The stalks are extremely tart, but make a great dessert when sweetened.",
  "253": "Triple Shot Espresso/450/3/Cooking -7/Triple Shot Espresso/It's more potent than regular coffee!/drink/0 0 0 0 0 0 0 0 0 1 0/360",
  "254": "Melon/250/45/Basic -79/Melon/A cool, sweet summer treat.",
  "256": "Tomato/60/8/Basic -75/Tomato/Rich and slightly tangy, the Tomato has a wide variety of culinary uses.",
  "257": "Morel/150/8/Basic -81/Morel/Sought after for its unique nutty flavor.",
  "258": "Blueberry/50/10/Basic -79/Blueberry/A popular berry reported to have many health benefits. The blue skin has the highest nutrient concentration.",
  "259": "Fiddlehead Fern/90/10/Basic -75/Fiddlehead Fern/The young shoots are an edible specialty.",
  "260": "Hot Pepper/40/5/Basic -79/Hot Pepper/Fiery hot with a hint of sweetness.",
  "261": "Warp Totem: Desert/20/-300/Crafting/Warp Totem: Desert/Warp directly to Calico Desert. Consumed on use.",
  "262": "Wheat/25/-300/Basic -75/Wheat/One of the most widely cultivated grains. Makes a great flour for breads and cakes.",
  "264": "Radish/90/18/Basic -75/Radish/A crisp and refreshing root vegetable with hints of pepper when eaten raw.",
  "266": "Red Cabbage/260/30/Basic -75/Red Cabbage/Often used in salads and coleslaws. The color can range from purple to blue to green-yellow depending on soil conditions.",
  "268": "Starfruit/750/50/Basic -79/Starfruit/An extremely juicy fruit that grows in hot, humid weather. Slightly sweet with a sour undertone.",
  "270": "Corn/50/10/Basic -75/Corn/One of the most popular grains. The sweet, fresh cobs are a summer favorite.",
  "271": "Unmilled Rice/30/1/Basic -75/Unmilled Rice/Rice in its rawest form. Run this through a mill to increase the value.",
  "272": "Eggplant/60/8/Basic -75/Eggplant/A rich and wholesome relative of the tomato. Delicious fried or stewed.",
  "273": "Rice Shoot/20/-300/Seeds -74/Rice Shoot/Plant these in the spring. Takes 8 days to mature. Grows faster if planted near a body of water. Harvest with the scythe.",
  "274": "Artichoke/160/12/Basic -75/Artichoke/The bud of a thistle plant. The spiny outer leaves conceal a fleshy, filling interior.",
  "275": "Artifact Trove/0/-300/Basic/Artifact Trove/A blacksmith can open this for you. These troves often contain ancient relics and curiosities./100 101 103 104 105 106 108 109 110 111 112 113 114 115 116 117 118 119 120 121 122 123 124 125 166 373 797",
  "276": "Pumpkin/320/-300/Basic -75/Pumpkin/A fall favorite, grown for its crunchy seeds and delicately flavored flesh. As a bonus, the hollow shell can be carved into a festive decoration.",
  "277": "Wilted Bouquet/100/-300/Basic/Wilted Bouquet/A gift that shows you want to stop dating someone.",
  "278": "Bok Choy/80/10/Basic -75/Bok Choy/The leafy greens and fibrous stalks are healthy and delicious.",
  "279": "Magic Rock Candy/5000/200/Cooking -7/Magic Rock Candy/A rare and powerful candy infused with the essence of the prismatic shard./food/0 0 2 0 5 0 0 0 0 1 5 5/720",
  "280": "Yam/160/18/Basic -75/Yam/A starchy tuber with a lot of culinary versatility.",
  "281": "Chanterelle/160/30/Basic -81/Chanterelle/A tasty mushroom with a fruity smell and slightly peppery flavor.",
  "282": "Cranberries/75/15/Basic -79/Cranberries/These tart red berries are a traditional winter food.",
  "283": "Holly/80/-15/Basic -81/Holly/The leaves and bright red berries make a popular winter decoration.",
  "284": "Beet/100/12/Basic -75/Beet/A sweet and earthy root vegatable. As a bonus, the leaves make a great salad.",
  "286": "Cherry Bomb/50/-300/Crafting -8/Cherry Bomb/Generates a small explosion. Stand back!",
  "287": "Bomb/50/-300/Crafting -8/Bomb/Generates an explosion. Watch out!",
  "288": "Mega Bomb/50/-300/Crafting -8/Mega Bomb/Generates a powerful explosion. Use with extreme caution.",
  "290": "Stone/50/-300/Basic/Stone/...",
  "293": "Brick Floor/1/-300/Crafting -24/Brick Floor/Place on the ground to create paths or to decorate your floors.",
  "294": "Twig/1/-300/Crafting/Twig/...",
  "295": "Twig/1/-300/Crafting/Twig/...",
  "296": "Salmonberry/5/10/Basic -79/Salmonberry/A spring-time berry with the flavor of the forest.",
  "297": "Grass Starter/50/-300/Crafting/Grass Starter/Place this on your farm to start a new patch of grass.",
  "298": "Hardwood Fence/10/-300/Crafting -8/Hardwood Fence/The most durable type of fence.",
  "299": "Amaranth Seeds/35/-300/Seeds -74/Amaranth Seeds/Plant these in the fall. Takes 7 days to grow. Harvest with the scythe.",
  "300": "Amaranth/150/20/Basic -75/Amaranth/A purple grain cultivated by an ancient civilization.",
  "301": "Grape Starter/30/-300/Seeds -74/Grape Starter/Plant these in the fall. Takes 10 days to grow, but keeps producing after that. Grows on a trellis.",
  "302": "Hops Starter/30/-300/Seeds -74/Hops Starter/Plant these in the summer. Takes 11 days to grow, but keeps producing after that. Grows on a trellis.",
  "303": "Pale Ale/300/20/Basic -26/Pale Ale/Drink in moderation./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "304": "Hops/25/18/Basic -75/Hops/A bitter, tangy flower used to flavor beer.",
  "305": "Void Egg/65/15/Basic -5/Void Egg/A jet-black egg with red flecks. It's warm to the touch.",
  "306": "Mayonnaise/190/-300/Basic -26/Mayonnaise/It looks spreadable.",
  "307": "Duck Mayonnaise/375/-300/Basic -26/Duck Mayonnaise/It's a rich, yellow mayonnaise.",
  "308": "Void Mayonnaise/275/-30/Basic -26/Void Mayonnaise/A thick, black paste that smells like burnt hair.",
  "309": "Acorn/20/-300/Crafting -74/Acorn/Place this on your farm to plant an oak tree.",
  "310": "Maple Seed/5/-300/Crafting -74/Maple Seed/Place this on your farm to plant a maple tree.",
  "311": "Pine Cone/5/-300/Crafting -74/Pine Cone/Place this on your farm to plant a pine tree.",
  "313": "Weeds/50/-300/Crafting/Weeds/...",
  "314": "Weeds/50/-300/Crafting/Weeds/...",
  "315": "Weeds/50/-300/Crafting/Weeds/...",
  "316": "Weeds/50/-300/Crafting/Weeds/...",
  "317": "Weeds/50/-300/Crafting/Weeds/...",
  "318": "Weeds/50/-300/Crafting/Weeds/...",
  "319": "Weeds/50/-300/Crafting/Weeds/...",
  "320": "Weeds/50/-300/Crafting/Weeds/...",
  "321": "Weeds/50/-300/Crafting/Weeds/...",
  "322": "Wood Fence/1/-300/Crafting -8/Wood Fence/Keeps grass and animals contained!",
  "323": "Stone Fence/2/-300/Crafting -8/Stone Fence/Lasts longer than a wood fence.",
  "324": "Iron Fence/6/-300/Crafting -8/Iron Fence/Lasts longer than a stone fence.",
  "325": "Gate/4/-300/Crafting -8/Gate/Allows you to pass through a fence.",
  "326": "Dwarvish Translation Guide/50/-300/Crafting -8/Dwarvish Translation Guide/Teaches you dwarvish.",
  "328": "Wood Floor/1/-300/Crafting -24/Wood Floor/Place on the ground to create paths or to decorate your floors.",
  "329": "Stone Floor/1/-300/Crafting -24/Stone Floor/Place on the ground to create paths or to spruce up your floors.",
  "330": "Clay/20/-300/Basic -16/Clay/Used in crafting and construction.",
  "331": "Weathered Floor/1/-300/Crafting -24/Weathered Floor/Place on the ground to create paths or to spruce up your floors.",
  "333": "Crystal Floor/1/-300/Crafting -24/Crystal Floor/Place on the ground to create paths or to spruce up your floors.",
  "334": "Copper Bar/60/-300/Basic -15/Copper Bar/A bar of pure copper.",
  "335": "Iron Bar/120/-300/Basic -15/Iron Bar/A bar of pure iron.",
  "336": "Gold Bar/250/-300/Basic -15/Gold Bar/A bar of pure gold.",
  "337": "Iridium Bar/1000/-300/Basic -15/Iridium Bar/A bar of pure iridium.",
  "338": "Refined Quartz/50/-300/Basic -15/Refined Quartz/A more pure form of quartz.",
  "340": "Honey/100/-300/Basic -26/Honey/It's a sweet syrup produced by bees.",
  "341": "Tea Set/200/-300/Basic -24/Tea Set/Fine porcelain.",
  "342": "Pickles/100/-300/Basic -26/Pickles/A jar of your home-made pickles.",
  "343": "Stone/100/-300/Basic/Stone/Stone.",
  "344": "Jelly/160/-300/Basic -26/Jelly/Gooey.",
  "346": "Beer/200/20/Basic -26/Beer/Drink in moderation./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "347": "Rare Seed/200/-300/Seeds -74/Rare Seed/Sow in fall. Takes all season to grow.",
  "348": "Wine/400/20/Basic -26/Wine/Drink in moderation./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "349": "Energy Tonic/500/200/Crafting/Energy Tonic/Restores a lot of energy./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "350": "Juice/150/30/Basic -26/Juice/A sweet, nutritious beverage./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "351": "Muscle Remedy/500/20/Crafting/Muscle Remedy/When you've pushed your body too hard, drink this to remove 'Exhaustion'./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "368": "Basic Fertilizer/2/-300/Basic -19/Basic Fertilizer/Improves soil quality a little, increasing your chance to grow quality crops. Mix into tilled soil.",
  "369": "Quality Fertilizer/10/-300/Basic -19/Quality Fertilizer/Improves soil quality, increasing your chance to grow quality crops. Mix into tilled soil.",
  "370": "Basic Retaining Soil/4/-300/Basic -19/Basic Retaining Soil/This soil has a chance of staying watered overnight. Mix into tilled soil.",
  "371": "Quality Retaining Soil/5/-300/Basic -19/Quality Retaining Soil/This soil has a good chance of staying watered overnight. Mix into tilled soil.",
  "372": "Clam/50/-300/Basic -23/Clam/Someone lived here once.",
  "373": "Golden Pumpkin/2500/-300/Basic/Golden Pumpkin/It's valuable but has no other purpose.",
  "378": "Copper Ore/5/-300/Basic -15/Copper Ore/A common ore that can be smelted into bars.",
  "380": "Iron Ore/10/-300/Basic -15/Iron Ore/A fairly common ore that can be smelted into bars.",
  "382": "Coal/15/-300/Basic -15/Coal/A combustible rock that is useful for crafting and smelting.",
  "384": "Gold Ore/25/-300/Basic -15/Gold Ore/A precious ore that can be smelted into bars.",
  "386": "Iridium Ore/100/-300/Basic -15/Iridium Ore/An exotic ore with many curious properties. Can be smelted into bars.",
  "388": "Wood/2/-300/Basic -16/Wood/A sturdy, yet flexible plant material with a wide variety of uses.",
  "390": "Stone/2/-300/Basic -16/Stone/A common material with many uses in crafting and building.",
  "392": "Nautilus Shell/120/-300/Basic -23/Nautilus Shell/An ancient shell.",
  "393": "Coral/80/-300/Basic -23/Coral/A colony of tiny creatures that clump together to form beautiful structures.",
  "394": "Rainbow Shell/300/-300/Basic -23/Rainbow Shell/It's a very beautiful shell.",
  "395": "Coffee/150/1/Crafting/Coffee/It smells delicious. This is sure to give you a boost./drink/0 0 0 0 0 0 0 0 0 1 0/120",
  "396": "Spice Berry/80/10/Basic -79/Spice Berry/It fills the air with a pungent aroma.",
  "397": "Sea Urchin/160/-300/Basic -23/Sea Urchin/A slow-moving, spiny creature that some consider a delicacy.",
  "398": "Grape/80/15/Basic -79/Grape/A sweet cluster of fruit.",
  "399": "Spring Onion/8/5/Basic -81/Spring Onion/These grow wild during the spring.",
  "400": "Strawberry/120/20/Basic -79/Strawberry/A sweet, juicy favorite with an appealing red color.",
  "401": "Straw Floor/1/-300/Crafting -24/Straw Floor/Place on the ground to create paths or to spruce up your floors.",
  "402": "Sweet Pea/50/0/Basic -80/Sweet Pea/A fragrant summer flower.",
  "403": "Field Snack/20/18/Crafting/Field Snack/A quick snack to fuel the hungry forager.",
  "404": "Common Mushroom/40/15/Basic -81/Common Mushroom/Slightly nutty, with good texture.",
  "405": "Wood Path/1/-300/Crafting -24/Wood Path/Place on the ground to create paths or to spruce up your floors.",
  "406": "Wild Plum/80/10/Basic -79/Wild Plum/Tart and juicy with a pungent aroma.",
  "407": "Gravel Path/1/-300/Crafting -24/Gravel Path/Place on the ground to create paths or to spruce up your floors.",
  "408": "Hazelnut/90/12/Basic -81/Hazelnut/That's one big hazelnut!",
  "409": "Crystal Path/1/-300/Crafting -24/Crystal Path/Place on the ground to create paths or to spruce up your floors.",
  "410": "Blackberry/20/10/Basic -79/Blackberry/An early-fall treat.",
  "411": "Cobblestone Path/1/-300/Crafting -24/Cobblestone Path/Place on the ground to create paths or to spruce up your floors.",
  "412": "Winter Root/70/10/Basic -81/Winter Root/A starchy tuber.",
  "413": "Blue Slime Egg/1750/-300/Basic/Blue Slime Egg/Can be hatched in a slime incubator.",
  "414": "Crystal Fruit/150/25/Basic -79/Crystal Fruit/A delicate fruit that pops up from the snow.",
  "415": "Stepping Stone Path/1/-300/Crafting -24/Stepping Stone Path/Place on the ground to create paths or to spruce up your floors.",
  "416": "Snow Yam/100/12/Basic -81/Snow Yam/This little yam was hiding beneath the snow.",
  "417": "Sweet Gem Berry/3000/-300/Basic -17/Sweet Gem Berry/It's by far the sweetest thing you've ever smelled.",
  "418": "Crocus/60/0/Basic -80/Crocus/A flower that can bloom in the winter.",
  "419": "Vinegar/100/5/Basic/Vinegar/An aged fermented liquid used in many cooking recipes./drink",
  "420": "Red Mushroom/75/-20/Basic -81/Red Mushroom/A spotted mushroom sometimes found in caves.",
  "421": "Sunflower/80/18/Basic -80/Sunflower/A common misconception is that the flower turns so it's always facing the sun.",
  "422": "Purple Mushroom/250/50/Basic -81/Purple Mushroom/A rare mushroom found deep in caves.",
  "423": "Rice/100/5/Basic/Rice/A basic grain often served under vegetables.",
  "424": "Cheese/230/50/Basic -26/Cheese/It's your basic cheese.",
  "426": "Goat Cheese/400/50/Basic -26/Goat Cheese/Soft cheese made from goat's milk.",
  "428": "Cloth/470/-300/Basic -26/Cloth/A bolt of fine wool cloth.",
  "430": "Truffle/625/5/Basic -17/Truffle/A gourmet type of mushroom with a unique taste.",
  "432": "Truffle Oil/1065/15/Basic -26/Truffle Oil/A gourmet cooking ingredient./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "433": "Coffee Bean/15/-300/Seeds -74/Coffee Bean/Plant in spring or summer to grow a coffee plant. Place five beans in a keg to make coffee.",
  "434": "Stardrop/7777/100/Crafting/Stardrop/A mysterious fruit that empowers those who eat it. The flavor is like a dream... a powerful personal experience, yet difficult to describe to others.",
  "436": "Goat Milk/225/25/Basic -6/Goat Milk/The milk of a goat./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "437": "Red Slime Egg/2500/-300/Basic/Red Slime Egg/Can be hatched in a slime incubator.",
  "438": "L. Goat Milk/345/35/Basic -6/L. Goat Milk/A gallon of creamy goat's milk./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "439": "Purple Slime Egg/5000/-300/Basic/Purple Slime Egg/Can be hatched in a slime incubator.",
  "440": "Wool/340/-300/Basic -18/Wool/Soft, fluffy wool.",
  "441": "Explosive Ammo/20/-300/Basic/Explosive Ammo/Fire this with the slingshot.",
  "442": "Duck Egg/95/15/Basic -5/Duck Egg/It's still warm.",
  "444": "Duck Feather/125/-300/Basic -18/Duck Feather/It's so colorful.",
  "446": "Rabbit's Foot/565/-300/Basic -18/Rabbit's Foot/Some say it's lucky.",
  "447": "Aged Roe/100/40/Basic -26/Aged Roe/Fish eggs aged in salt to bring out the flavor.",
  "449": "Stone Base/0/-300/asdf/Stone Base/A simple block of stone.",
  "450": "Stone/0/-300/asdf/Stone/Stone.",
  "452": "Weeds/0/-300/asdf/Weeds/A cluster of dry old bushes.",
  "454": "Ancient Fruit/550/-300/Basic -79/Ancient Fruit/It's been dormant for eons.",
  "456": "Algae Soup/100/30/Cooking -7/Algae Soup/It's a little slimy./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "457": "Pale Broth/150/50/Cooking -7/Pale Broth/A delicate broth with a hint of sulfur./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "458": "Bouquet/100/-300/Basic/Bouquet/A gift that shows your romantic interest.",
  "459": "Mead/200/30/Basic -26/Mead/A fermented beverage made from honey. Drink in moderation./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "460": "Mermaid's Pendant/2500/-300/Basic/Mermaid's Pendant/Give this to the person you want to marry.",
  "461": "Decorative Pot/200/-300/Crafting/Decorative Pot/A replica of an ancient pot.",
  "463": "Drum Block/100/-300/Crafting/Drum Block/Plays a drum sound when you walk past.",
  "464": "Flute Block/100/-300/Crafting/Flute Block/Plays a flute sound when you walk past.",
  "465": "Speed-Gro/20/-300/Basic -19/Speed-Gro/Stimulates leaf production. Guaranteed to increase growth rate by at least 10%. Mix into tilled soil.",
  "466": "Deluxe Speed-Gro/40/-300/Basic -19/Deluxe Speed-Gro/Stimulates leaf production. Guaranteed to increase growth rate by at least 25%. Mix into tilled soil.",
  "472": "Parsnip Seeds/10/-300/Seeds -74/Parsnip Seeds/Plant these in the spring. Takes 4 days to mature.",
  "473": "Bean Starter/30/-300/Seeds -74/Bean Starter/Plant these in the spring. Takes 10 days to mature, but keeps producing after that. Grows on a trellis.",
  "474": "Cauliflower Seeds/40/-300/Seeds -74/Cauliflower Seeds/Plant these in the spring. Takes 12 days to produce a large cauliflower.",
  "475": "Potato Seeds/25/-300/Seeds -74/Potato Seeds/Plant these in the spring. Takes 6 days to mature, and has a chance of yielding multiple potatoes at harvest.",
  "476": "Garlic Seeds/20/-300/Seeds -74/Garlic Seeds/Plant these in the spring. Takes 4 days to mature.",
  "477": "Kale Seeds/35/-300/Seeds -74/Kale Seeds/Plant these in the spring. Takes 6 days to mature. Harvest with the scythe.",
  "478": "Rhubarb Seeds/50/-300/Seeds -74/Rhubarb Seeds/Plant these in the spring. Takes 13 days to mature.",
  "479": "Melon Seeds/40/-300/Seeds -74/Melon Seeds/Plant these in the summer. Takes 12 days to mature.",
  "480": "Tomato Seeds/25/-300/Seeds -74/Tomato Seeds/Plant these in the summer. Takes 11 days to mature, and continues to produce after first harvest.",
  "481": "Blueberry Seeds/40/-300/Seeds -74/Blueberry Seeds/Plant these in the summer. Takes 13 days to mature, and continues to produce after first harvest.",
  "482": "Pepper Seeds/20/-300/Seeds -74/Pepper Seeds/Plant these in the summer. Takes 5 days to mature, and continues to produce after first harvest.",
  "483": "Wheat Seeds/5/-300/Seeds -74/Wheat Seeds/Plant these in the summer or fall. Takes 4 days to mature. Harvest with the scythe.",
  "484": "Radish Seeds/20/-300/Seeds -74/Radish Seeds/Plant these in the summer. Takes 6 days to mature.",
  "485": "Red Cabbage Seeds/50/-300/Seeds -74/Red Cabbage Seeds/Plant these in the summer. Takes 9 days to mature.",
  "486": "Starfruit Seeds/200/-300/Seeds -74/Starfruit Seeds/Plant these in the summer. Takes 13 days to mature.",
  "487": "Corn Seeds/75/-300/Seeds -74/Corn Seeds/Plant these in the summer or fall. Takes 14 days to mature, and continues to produce after first harvest.",
  "488": "Eggplant Seeds/10/-300/Seeds -74/Eggplant Seeds/Plant these in the fall. Takes 5 days to mature, and continues to produce after first harvest.",
  "489": "Artichoke Seeds/15/-300/Seeds -74/Artichoke Seeds/Plant these in the fall. Takes 8 days to mature.",
  "490": "Pumpkin Seeds/50/-300/Seeds -74/Pumpkin Seeds/Plant these in the fall. Takes 13 days to mature.",
  "491": "Bok Choy Seeds/25/-300/Seeds -74/Bok Choy Seeds/Plant these in the fall. Takes 4 days to mature.",
  "492": "Yam Seeds/30/-300/Seeds -74/Yam Seeds/Plant these in the fall. Takes 10 days to mature.",
  "493": "Cranberry Seeds/120/-300/Seeds -74/Cranberry Seeds/Plant these in the fall. Takes 7 days to mature, and continues to produce after first harvest.",
  "494": "Beet Seeds/10/-300/Seeds -74/Beet Seeds/Plant these in the fall. Takes 6 days to mature.",
  "495": "Spring Seeds/35/-300/Seeds -74/Spring Seeds/An assortment of wild spring seeds.",
  "496": "Summer Seeds/55/-300/Seeds -74/Summer Seeds/An assortment of wild summer seeds.",
  "497": "Fall Seeds/45/-300/Seeds -74/Fall Seeds/An assortment of wild fall seeds.",
  "498": "Winter Seeds/30/-300/Seeds -74/Winter Seeds/An assortment of wild winter seeds.",
  "499": "Ancient Seeds/30/-300/Seeds -74/Ancient Seeds/Could these still grow?",
  "427": "Tulip Bulb/10/-300/Seeds -74/Tulip Bulb/Plant in spring. Takes 6 days to produce a colorful flower. Assorted colors.",
  "429": "Jazz Seeds/15/-300/Seeds -74/Jazz Seeds/Plant in spring. Takes 7 days to produce a blue puffball flower.",
  "453": "Poppy Seeds/50/-300/Seeds -74/Poppy Seeds/Plant in summer. Produces a bright red flower in 7 days.",
  "455": "Spangle Seeds/25/-300/Seeds -74/Spangle Seeds/Plant in summer. Takes 8 days to produce a vibrant tropical flower. Assorted colors.",
  "431": "Sunflower Seeds/20/-300/Seeds -74/Sunflower Seeds/Plant in summer or fall. Takes 8 days to produce a large sunflower. Yields more seeds at harvest.",
  "425": "Fairy Seeds/100/-300/Seeds -74/Fairy Seeds/Plant in fall. Takes 12 days to produce a mysterious flower. Assorted Colors.",
  "516": "Small Glow Ring/100/-300/Ring/Small Glow Ring/Emits a small, constant light.",
  "517": "Glow Ring/200/-300/Ring/Glow Ring/Emits a constant light.",
  "518": "Small Magnet Ring/100/-300/Ring/Small Magnet Ring/Slightly increases your radius for collecting items.",
  "519": "Magnet Ring/200/-300/Ring/Magnet Ring/Increases your radius for collecting items.",
  "520": "Slime Charmer Ring/700/-300/Ring/Slime Charmer Ring/Prevents damage from slimes.",
  "521": "Warrior Ring/1500/-300/Ring/Warrior Ring/Occasionally infuses the wearer with \"warrior energy\" after slaying a monster.",
  "522": "Vampire Ring/1500/-300/Ring/Vampire Ring/Gain a little health every time you slay a monster.",
  "523": "Savage Ring/1500/-300/Ring/Savage Ring/Gain a short speed boost whenever you slay a monster.",
  "524": "Ring of Yoba/1500/-300/Ring/Ring of Yoba/Occasionally shields the wearer from damage.",
  "525": "Sturdy Ring/1500/-300/Ring/Sturdy Ring/Cuts the duration of negative status effects in half.",
  "526": "Burglar's Ring/1500/-300/Ring/Burglar's Ring/Monsters have a greater chance of dropping loot.",
  "527": "Iridium Band/2000/-300/Ring/Iridium Band/Glows, attracts items, and increases attack damage by 10%.",
  "528": "Jukebox Ring/200/-300/Ring/Jukebox Ring/Plays a random assortment of music you've heard.",
  "529": "Amethyst Ring/200/-300/Ring/Amethyst Ring/Increases knockback by 10%.",
  "530": "Topaz Ring/200/-300/Ring/Topaz Ring/Increases weapon precision by 10%.",
  "531": "Aquamarine Ring/400/-300/Ring/Aquamarine Ring/Increases critical strike chance by 10%.",
  "532": "Jade Ring/400/-300/Ring/Jade Ring/Increases critical strike power by 10%.",
  "533": "Emerald Ring/600/-300/Ring/Emerald Ring/Increases weapon speed by 10%.",
  "534": "Ruby Ring/600/-300/Ring/Ruby Ring/Increases attack by 10%.",
  "535": "Geode/50/-300/Basic/Geode/A blacksmith can break this open for you./538 542 548 549 552 555 556 557 558 566 568 569 571 574 576 121",
  "536": "Frozen Geode/100/-300/Basic/Frozen Geode/A blacksmith can break this open for you./541 544 545 546 550 551 559 560 561 564 567 572 573 577 123",
  "537": "Magma Geode/150/-300/Basic/Magma Geode/A blacksmith can break this open for you./539 540 543 547 553 554 562 563 565 570 575 578 122",
  "538": "Alamite/150/-300/Minerals -12/Alamite/Its distinctive fluorescence makes it a favorite among rock collectors.",
  "539": "Bixite/300/-300/Minerals -12/Bixite/A dark metallic Mineral sought after for its cubic structure.",
  "540": "Baryte/50/-300/Minerals -12/Baryte/The best specimens resemble a desert rose.",
  "541": "Aerinite/125/-300/Minerals -12/Aerinite/These crystals are curiously light.",
  "542": "Calcite/75/-300/Minerals -12/Calcite/This yellow crystal is speckled with shimmering nodules.",
  "543": "Dolomite/300/-300/Minerals -12/Dolomite/It can occur in coral reefs, often near an underwater volcano.",
  "544": "Esperite/100/-300/Minerals -12/Esperite/The crystals glow bright green when stimulated.",
  "545": "Fluorapatite/200/-300/Minerals -12/Fluorapatite/Small amounts are found in human teeth.",
  "546": "Geminite/150/-300/Minerals -12/Geminite/Occurs in brilliant clusters.",
  "547": "Helvite/450/-300/Minerals -12/Helvite/It grows in a triangular column.",
  "548": "Jamborite/150/-300/Minerals -12/Jamborite/The crystals are so tightly packed it almost looks fuzzy.",
  "549": "Jagoite/115/-300/Minerals -12/Jagoite/A high volume of tiny crystals makes it very glittery.",
  "550": "Kyanite/250/-300/Minerals -12/Kyanite/The geometric faces are as smooth as glass.",
  "551": "Lunarite/200/-300/Minerals -12/Lunarite/The cratered white orbs form a tight cluster.",
  "552": "Malachite/100/-300/Minerals -12/Malachite/A popular ornamental stone, used in sculpture and to make green paint.",
  "553": "Neptunite/400/-300/Minerals -12/Neptunite/A jet-black crystal that is unusually reflective.",
  "554": "Lemon Stone/200/-300/Minerals -12/Lemon Stone/Some claim the powdered crystal is a dwarvish delicacy.",
  "555": "Nekoite/80/-300/Minerals -12/Nekoite/The delicate shards form a tiny pink meadow.",
  "556": "Orpiment/80/-300/Minerals -12/Orpiment/Despite its high toxicity, this Mineral is widely used in manufacturing and folk medicine.",
  "557": "Petrified Slime/120/-300/Minerals -12/Petrified Slime/This little guy may be 100,000 years old.",
  "558": "Thunder Egg/100/-300/Minerals -12/Thunder Egg/According to legend, angry thunder spirits would throw these stones at one another.",
  "559": "Pyrite/120/-300/Minerals -12/Pyrite/Commonly known as \"Fool's Gold\".",
  "560": "Ocean Stone/220/-300/Minerals -12/Ocean Stone/An old legend claims these stones are the mosaics of ancient mermaids.",
  "561": "Ghost Crystal/200/-300/Minerals -12/Ghost Crystal/There is an aura of coldness around this crystal.",
  "562": "Tigerseye/275/-300/Minerals -12/Tigerseye/A stripe of shimmering gold gives this gem a warm luster.",
  "563": "Jasper/150/-300/Minerals -12/Jasper/When polished, this stone becomes attactively luminous. Prized by ancient peoples for thousands of years.",
  "564": "Opal/150/-300/Minerals -12/Opal/Its internal structure causes it to reflect a rainbow of light.",
  "565": "Fire Opal/350/-300/Minerals -12/Fire Opal/A rare variety of opal, named for its red spots.",
  "566": "Celestine/125/-300/Minerals -12/Celestine/Some early life forms had bones made from this.",
  "567": "Marble/110/-300/Minerals -12/Marble/A very popular material for sculptures and construction.",
  "568": "Sandstone/60/-300/Minerals -12/Sandstone/A common type of stone with red and brown striations.",
  "569": "Granite/75/-300/Minerals -12/Granite/A speckled Mineral that is commonly used in construction.",
  "570": "Basalt/175/-300/Minerals -12/Basalt/Forms near searing hot magma.",
  "571": "Limestone/15/-300/Minerals -12/Limestone/A very common type of stone. It's not worth very much.",
  "572": "Soapstone/120/-300/Minerals -12/Soapstone/Because of its relatively soft consistency, this stone is very popular for carving.",
  "573": "Hematite/150/-300/Minerals -12/Hematite/An iron-based Mineral with interesting magnetic properties.",
  "574": "Mudstone/25/-300/Minerals -12/Mudstone/A fine-grained rock made from ancient clay or mud.",
  "575": "Obsidian/200/-300/Minerals -12/Obsidian/A volcanic glass that forms when lava cools rapidly.",
  "576": "Slate/85/-300/Minerals -12/Slate/It's extremely resistant to water, making it a good roofing material.",
  "577": "Fairy Stone/250/-300/Minerals -12/Fairy Stone/An old miner's song suggests these are made from the bones of ancient fairies.",
  "578": "Star Shards/500/-300/Minerals -12/Star Shards/No one knows how these form. Some scientists claim that the microscopic structure displays unnatural regularity.",
  "579": "Prehistoric Scapula/100/-300/Arch/Prehistoric Scapula/Commonly known as a \"shoulder blade\"... It's unclear what species it belonged to./Town .01",
  "580": "Prehistoric Tibia/100/-300/Arch/Prehistoric Tibia/A thick and sturdy leg bone./Forest .01",
  "581": "Prehistoric Skull/100/-300/Arch/Prehistoric Skull/This is definitely a mammalian skull./Mountain .01",
  "582": "Skeletal Hand/100/-300/Arch/Skeletal Hand/It's a wonder all these ancient little pieces lasted so long./Beach .01",
  "583": "Prehistoric Rib/100/-300/Arch/Prehistoric Rib/Little gouge marks on the side suggest that this rib was someone's dinner./Farm .01",
  "584": "Prehistoric Vertebra/100/-300/Arch/Prehistoric Vertebra/A segment of some prehistoric creature's spine./BusStop .01",
  "585": "Skeletal Tail/100/-300/Arch/Skeletal Tail/It's pretty short for a tail./UndergroundMine .01",
  "586": "Nautilus Fossil/80/-300/Arch/Nautilus Fossil/This must've washed up ages ago from an ancient coral reef. /Beach .03",
  "587": "Amphibian Fossil/150/-300/Arch/Amphibian Fossil/The relatively short hind legs suggest some kind of primordial toad./Forest .01 Mountain .01",
  "588": "Palm Fossil/100/-300/Arch/Palm Fossil/Palm Fossils are relatively common, but this happens to be a particularly well-preserved specimen./Desert .1 Beach .01 Forest .01",
  "589": "Trilobite/50/-300/Arch/Trilobite/A long extinct relative of the crab./Beach .03 Mountain .03 Forest .03",
  "590": "Artifact Spot/0/-300/asdf/Artifact Spot/Uh... how did you get this in your inventory? Ape made a booboo./Beach .03 Mountain .03 Forest .03",
  "591": "Tulip/30/18/Basic -80/Tulip/The most popular spring flower. Has a very faint sweet smell.",
  "593": "Summer Spangle/90/18/Basic -80/Summer Spangle/A tropical bloom that thrives in the humid summer air. Has a sweet, tangy aroma.",
  "595": "Fairy Rose/290/18/Basic -80/Fairy Rose/An old folk legend suggests that the sweet smell of this flower attracts fairies.",
  "597": "Blue Jazz/50/18/Basic -80/Blue Jazz/The flower grows in a sphere to invite as many butterflies as possible.",
  "599": "Sprinkler/100/-300/Crafting -8/Sprinkler/Waters the 4 adjacent tiles every morning.",
  "376": "Poppy/140/18/Basic -80/Poppy/In addition to its colorful flower, the Poppy has culinary and medicinal uses.",
  "604": "Plum Pudding/260/70/Cooking -7/Plum Pudding/A traditional holiday treat./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "605": "Artichoke Dip/210/40/Cooking -7/Artichoke Dip/It's cool and refreshing./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "606": "Stir Fry/335/80/Cooking -7/Stir Fry/Julienned vegetables on a bed of rice./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "607": "Roasted Hazelnuts/270/70/Cooking -7/Roasted Hazelnuts/The roasting process creates a rich forest flavor./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "608": "Pumpkin Pie/385/90/Cooking -7/Pumpkin Pie/Silky pumpkin cream in a flakey crust./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "609": "Radish Salad/300/80/Cooking -7/Radish Salad/The radishes are so crisp!/food/0 0 0 0 0 0 0 0 0 0 0/0",
  "610": "Fruit Salad/450/105/Cooking -7/Fruit Salad/A delicious combination of summer fruits./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "611": "Blackberry Cobbler/260/70/Cooking -7/Blackberry Cobbler/There's nothing quite like it./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "612": "Cranberry Candy/175/50/Cooking -7/Cranberry Candy/It's sweet enough to mask the bitter fruit./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "613": "Apple/100/15/Basic -79/Apple/A crisp fruit used for juice and cider.",
  "614": "Green Tea/100/5/Basic -26/Green Tea/A pleasant, energizing beverage made from lightly processed tea leaves./drink/0 0 0 0 0 0 0 30 0 0 0/360",
  "618": "Bruschetta/210/45/Cooking -7/Bruschetta/Roasted tomatoes on a crisp white bread./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "621": "Quality Sprinkler/450/-300/Crafting -8/Quality Sprinkler/Waters the 8 adjacent tiles every morning.",
  "645": "Iridium Sprinkler/1000/-300/Crafting -8/Iridium Sprinkler/Waters the 24 adjacent tiles every morning.",
  "648": "Coleslaw/345/85/Cooking -7/Coleslaw/It's light, fresh and very healthy./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "649": "Fiddlehead Risotto/350/90/Cooking -7/Fiddlehead Risotto/A creamy rice dish served with sauteed fern heads. It's a little bland./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "651": "Poppyseed Muffin/250/60/Cooking -7/Poppyseed Muffin/It has a soothing effect./food/0 0 0 0 0 0 0 0 0 0 0/0",
  "628": "Cherry Sapling/850/-300/Basic -74/Cherry Sapling/Takes 28 days to produce a mature cherry tree. Bears fruit in the spring. Only grows if the 8 surrounding \"tiles\" are empty.",
  "629": "Apricot Sapling/500/-300/Basic -74/Apricot Sapling/Takes 28 days to produce a mature Apricot tree. Bears fruit in the spring. Only grows if the 8 surrounding \"tiles\" are empty.",
  "630": "Orange Sapling/1000/-300/Basic -74/Orange Sapling/Takes 28 days to produce a mature Orange tree. Bears fruit in the summer. Only grows if the 8 surrounding \"tiles\" are empty.",
  "631": "Peach Sapling/1500/-300/Basic -74/Peach Sapling/Takes 28 days to produce a mature Peach tree. Bears fruit in the summer. Only grows if the 8 surrounding \"tiles\" are empty.",
  "632": "Pomegranate Sapling/1500/-300/Basic -74/Pomegranate Sapling/Takes 28 days to produce a mature Pomegranate tree. Bears fruit in the fall. Only grows if the 8 surrounding \"tiles\" are empty.",
  "633": "Apple Sapling/1000/-300/Basic -74/Apple Sapling/Takes 28 days to produce a mature Apple tree. Bears fruit in the fall. Only grows if the 8 surrounding \"tiles\" are empty.",
  "634": "Apricot/50/15/Basic -79/Apricot/A tender little fruit with a rock-hard pit.",
  "635": "Orange/100/15/Basic -79/Orange/Juicy, tangy, and bursting with sweet summer aroma.",
  "636": "Peach/140/15/Basic -79/Peach/It's almost fuzzy to the touch.",
  "637": "Pomegranate/140/15/Basic -79/Pomegranate/Within the fruit are clusters of juicy seeds.",
  "638": "Cherry/80/15/Basic -79/Cherry/It's popular, and ripens sooner than most other fruits.",
  "668": "Stone/0/15/Basic/Stone/There's stone ore in this stone.",
  "670": "Stone/0/15/Basic/Stone/There's stone ore in this stone.",
  "674": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "675": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "676": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "677": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "678": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "679": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "680": "Green Slime Egg/1000/-300/Basic/Green Slime Egg/Can be hatched in a slime incubator.",
  "681": "Rain Totem/20/-300/Crafting/Rain Totem/Activate to greatly increase the chance for rain tomorrow. Consumed on use.",
  "682": "Mutant Carp/1000/10/Fish -4/Mutant Carp/The strange waters of the sewer turned this carp into a monstrosity./Day^Spring Summer",
  "684": "Bug Meat/8/-300/Basic -28/Bug Meat/It's a juicy wad of bug flesh.",
  "685": "Bait/1/-300/Basic -21/Bait/Causes fish to bite faster. Must first be attached to a fishing rod.",
  "686": "Spinner/250/-300/Basic -22/Spinner/The shape makes it spin around in the water. Slightly increases the bite-rate when fishing.",
  "687": "Dressed Spinner/500/-300/Basic -22/Dressed Spinner/The metal tab and colorful streamers create an enticing spectacle for fish. Increases the bite-rate when fishing.",
  "688": "Warp Totem: Farm/20/-300/Crafting/Warp Totem: Farm/Warp directly to your house. Consumed on use.",
  "689": "Warp Totem: Mountains/20/-300/Crafting/Warp Totem: Mountains/Warp directly to the mountains. Consumed on use.",
  "690": "Warp Totem: Beach/20/-300/Crafting/Warp Totem: Beach/Warp directly to the beach. Consumed on use.",
  "691": "Barbed Hook/500/-300/Basic -22/Barbed Hook/Makes your catch more secure, causing the \"fishing bar\" to cling to your catch. Works best on slow, weak fish.",
  "692": "Lead Bobber/150/-300/Basic -22/Lead Bobber/Adds weight to your \"fishing bar\", preventing it from bouncing along the bottom.",
  "693": "Treasure Hunter/250/-300/Basic -22/Treasure Hunter/Fish don't escape while collecting treasures. Also slightly increases the chance to find treasures.",
  "694": "Trap Bobber/200/-300/Basic -22/Trap Bobber/Causes fish to escape slower when you aren't reeling them in.",
  "695": "Cork Bobber/250/-300/Basic -22/Cork Bobber/Slightly increases the size of your \"fishing bar\".",
  "698": "Sturgeon/200/10/Fish -4/Sturgeon/An ancient bottom-feeder with a dwindling population. Females can live up to 150 years./Day^Spring Summer",
  "699": "Tiger Trout/150/10/Fish -4/Tiger Trout/A rare hybrid trout that cannot bear offspring of its own./Day^Spring Summer",
  "700": "Bullhead/75/10/Fish -4/Bullhead/A relative of the catfish that eats a variety of foods off the lake bottom./Day^Spring Summer",
  "701": "Tilapia/75/10/Fish -4/Tilapia/A primarily vegetarian fish that prefers warm water./Day^Spring Summer",
  "702": "Chub/50/10/Fish -4/Chub/A common freshwater fish known for its voracious appetite./Day^Spring Summer",
  "703": "Magnet/15/-300/Basic -21/Magnet/Increases the chance of finding treasures when fishing. However, fish aren't crazy about the taste.",
  "704": "Dorado/100/10/Fish -4/Dorado/A fierce carnivore with brilliant orange scales./Day^Summer",
  "705": "Albacore/75/10/Fish -4/Albacore/Prefers temperature \"edges\" where cool and warm water meet./Day^Spring Fall",
  "706": "Shad/60/10/Fish -4/Shad/Lives in a school at sea, but returns to the rivers to spawn./Day^Spring Summer Fall",
  "707": "Lingcod/120/10/Fish -4/Lingcod/A fearsome predator that will eat almost anything it can cram into its mouth./Day^Fall",
  "708": "Halibut/80/10/Fish -4/Halibut/A flat fish that lives on the ocean floor./Day^Spring Summer",
  "709": "Hardwood/15/-300/Basic -16/Hardwood/A special kind of wood with superior strength and beauty.",
  "710": "Crab Pot/50/-300/Crafting/Crab Pot/Place it in the water, load it with bait, and check the next day to see if you've caught anything. Works in streams, lakes, and the ocean.",
  "715": "Lobster/120/-300/Fish -4/Lobster/A large ocean-dwelling crustacean with a strong tail./Day^Spring Summer",
  "716": "Crayfish/75/-300/Fish -4/Crayfish/A small freshwater relative of the lobster./Day^Spring Summer",
  "717": "Crab/100/-300/Fish -4/Crab/A marine crustacean with two powerful pincers./Day^Spring Summer",
  "718": "Cockle/50/-300/Fish -4/Cockle/A common saltwater clam./Day^Spring Summer",
  "719": "Mussel/30/-300/Fish -4/Mussel/A common bivalve that often lives in clusters./Day^Spring Summer",
  "720": "Shrimp/60/-300/Fish -4/Shrimp/A scavenger that feeds off the ocean floor. Widely prized for its meat./Day^Spring Summer",
  "721": "Snail/65/-300/Fish -4/Snail/A wide-ranging mollusc that lives in a spiral shell./Day^Spring Summer",
  "722": "Periwinkle/20/-300/Fish -4/Periwinkle/A tiny freshwater snail that lives in a blue shell./Day^Spring Summer",
  "723": "Oyster/40/-300/Fish -4/Oyster/Constantly filters water to find food. In the process, it removes dangerous toxins from the environment./Day^Spring Summer",
  "724": "Maple Syrup/200/20/Basic -27/Maple Syrup/A sweet syrup with a unique flavor./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "725": "Oak Resin/150/-300/Basic -27/Oak Resin/A sticky, fragrant substance derived from oak sap.",
  "726": "Pine Tar/100/-300/Basic -27/Pine Tar/A pungent substance derived from pine sap.",
  "727": "Chowder/135/90/Cooking -7/Chowder/A perfect way to warm yourself after a cold night at sea./food/0 1 0 0 0 0 0 0 0 0 0/1440",
  "730": "Lobster Bisque/205/90/Cooking -7/Lobster Bisque/This delicate soup is a secret family recipe of Willy's./food/0 3 0 0 0 0 0 50 0 0 0/1440",
  "728": "Fish Stew/175/90/Cooking -7/Fish Stew/It smells a lot like the sea. Tastes better, though./food/0 3 0 0 0 0 0 0 0 0 0/1440",
  "729": "Escargot/125/90/Cooking -7/Escargot/Butter-soaked snails cooked to perfection./food/0 2 0 0 0 0 0 0 0 0 0/1440",
  "731": "Maple Bar/300/90/Cooking -7/Maple Bar/It's a sweet doughnut topped with a rich maple glaze./food/1 1 1 0 0 0 0 0 0 0 0/1440",
  "732": "Crab Cakes/275/90/Cooking -7/Crab Cakes/Crab, bread crumbs, and egg formed into patties then fried to a golden brown./food/0 0 0 0 0 0 0 0 0 1 1/1440",
  "733": "Shrimp Cocktail/160/90/Cooking -7/Shrimp Cocktail/A sumptuous appetizer made with freshly-caught shrimp./food/0 1 0 0 1 0 0 0 0 0 0/860",
  "734": "Woodskip/75/10/Fish -4/Woodskip/A very sensitive fish that can only live in pools deep in the forest./Day^Spring Summer",
  "745": "Strawberry Seeds/0/-300/Seeds -74/Strawberry Seeds/Plant these in spring. Takes 8 days to mature, and keeps producing strawberries after that.",
  "746": "Jack-O-Lantern/0/-300/Crafting -8/Jack-O-Lantern/A whimsical fall decoration.",
  "747": "Rotten Plant/0/-300/Basic -20/Rotten Plant/Decomposing organic material. It's slimy and unpleasant.",
  "748": "Rotten Plant/0/-300/Basic -20/Rotten Plant/Decomposing organic material. It's slimy and unpleasant.",
  "749": "Omni Geode/0/-300/Basic/Omni Geode/A blacksmith can break this open for you. These geodes contain a wide variety of Minerals./538 542 548 549 552 555 556 557 558 566 568 569 571 574 576 541 544 545 546 550 551 559 560 561 564 567 572 573 577 539 540 543 547 553 554 562 563 565 570 575 578 121 122 123",
  "750": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "751": "Stone/0/15/Basic/Stone/There's copper ore in this stone.",
  "760": "Stone/0/15/Basic/Stone/...",
  "762": "Stone/0/15/Basic/Stone/...",
  "764": "Stone/0/15/Basic/Stone/gold ore",
  "765": "Stone/0/15/Basic/Stone/iridium ore",
  "766": "Slime/5/-300/Basic -28/Slime/A shimmering, gelatinous glob with no smell.",
  "767": "Bat Wing/15/-300/Basic -28/Bat Wing/The material is surprisingly delicate.",
  "768": "Solar Essence/40/-300/Basic -28/Solar Essence/The glowing face is warm to the touch.",
  "769": "Void Essence/50/-300/Basic -28/Void Essence/It's quivering with dark energy.",
  "770": "Mixed Seeds/0/-300/Seeds -74/Mixed Seeds/There's a little bit of everything here. Plant them and see what grows!",
  "771": "Fiber/1/-300/Basic -16/Fiber/Raw material sourced from plants.",
  "772": "Oil of Garlic/1000/80/Cooking -7/Oil of Garlic/Drink this and weaker monsters will avoid you./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "773": "Life Elixir/500/80/Cooking -7/Life Elixir/Restores health to full./drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "774": "Wild Bait/15/-300/Basic -21/Wild Bait/A unique recipe from Linus that gives you a chance to catch two fish at once.",
  "775": "Glacierfish/1000/10/Fish -4/Glacierfish/Builds a nest on the underside of glaciers./Day^Winter",
  "784": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "785": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "786": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "787": "Battery Pack/500/-300/Basic -16/Battery Pack/It's fully charged with precious energy.",
  "788": "Lost Axe/0/-300/Quest/Lost Axe/Robin's been looking everywhere for it.",
  "789": "Lucky Purple Shorts/0/-300/Quest/Lucky Purple Shorts/Better not inspect these too closely.",
  "790": "Berry Basket/0/-300/Quest/Berry Basket/The fibers are stained with berry juice.",
  "792": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "793": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "794": "Weeds/0/15/Basic/Weeds/Ugly weeds.",
  "795": "Void Salmon/150/25/Fish -4/Void Salmon/A salmon, twisted by void energy. The fresh meat is jet black, but rapidly turns pink when exposed to air./Day^Spring Summer",
  "796": "Slimejack/100/15/Fish -4/Slimejack/He's coated in a very thick layer of slime. He keeps slipping out of your hands!/Day^Spring Summer",
  "797": "Pearl/2500/-300/Basic/Pearl/A rare treasure from the sea.",
  "798": "Midnight Squid/100/15/Fish -4/Midnight Squid/A strange and mysterious denizen of the ocean's twilight depths./Day^Spring Summer",
  "799": "Spook Fish/220/15/Fish -4/Spook Fish/The huge eyes can detect the faint silhouettes of prey./Day^Spring Summer",
  "800": "Blobfish/500/15/Fish -4/Blobfish/This odd creature floats above the ocean floor, consuming any edible material in its path./Day^Spring Summer",
  "801": "Wedding Ring/2000/-300/Ring/Wedding Ring/An old Zuzu City tradition... It's used to ask for another farmer's hand in marriage.",
  "802": "Cactus Seeds/0/-300/Seeds -74/Cactus Seeds/Can only be grown indoors. Takes 12 days to mature, and then produces fruit every 3 days.",
  "803": "Iridium Milk/0/-2/Basic/Iridium Milk/A powerful 'milk' of unknown origin.../drink/0 0 0 0 0 0 0 0 0 0 0/0",
  "805": "Tree Fertilizer/10/-300/Basic -19/Tree Fertilizer/Sprinkle on a wild tree to ensure rapid growth, even in winter. Doesn't work on fruit trees.",
  "807": "Dinosaur Mayonnaise/800/-300/Basic -26/Dinosaur Mayonnaise/It's thick and creamy, with a vivid green hue. It smells like grass and leather.",
  "808": "Void Ghost Pendant/4500/-300/Basic/Void Ghost Pendant/It's symoblic to the shadow people. As a gift, it signifies the desire to move in together as friends.",
  "809": "Movie Ticket/500/-300/Basic/Movie Ticket/Admits one to the movie theater. Giving this to a friend invites them to the movies with you.",
  "810": "Crabshell Ring/2000/-300/Ring/Crabshell Ring/The top of the ring is made from enchanted crab shell.",
  "811": "Napalm Ring/2000/-300/Ring/Napalm Ring/When you defeat an enemy, they explode.",
  "812": "Roe/30/20/Basic -23/Roe/Fresh fish eggs. These can be aged in a preserves jar to bring out more flavor.",
  "445": "Caviar/500/70/Basic -26/Caviar/The cured roe of a sturgeon fish. Considered to be a luxurious delicacy!",
  "814": "Squid Ink/110/-300/Basic -23/Squid Ink/Squid use this ink to confuse would-be predators.",
  "815": "Tea Leaves/50/-300/Basic -75/Tea Leaves/The young leaves of the tea plant. Can be brewed into the popular, energizing beverage.",
  "267": "Flounder/100/15/Fish -4/Flounder/It lives on the bottom, so both eyes are on top of its head./Day^Spring Summer",
  "265": "Seafoam Pudding/300/70/Cooking -7/Seafoam Pudding/This briny pudding will really get you into the maritime mindset!/food/0 4 0 0 0 0 0 0 0 0 0/300",
  "269": "Midnight Carp/150/20/Fish -4/Midnight Carp/This shy fish only feels comfortable at night./Night^Fall Winter"
