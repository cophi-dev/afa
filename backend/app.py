from flask import Flask, request, jsonify, send_file, send_from_directory, url_for
from flask_cors import CORS
from PIL import Image
import json
import os
from io import BytesIO

app = Flask(__name__, static_folder='public', static_url_path='/')
CORS(app, resources={r"/api/*": {"origins": ["https://afa-editor.vercel.app", "http://localhost:3000"]}})

# Use absolute paths for file access
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'traits'))

special_assets = {
    'cheetah_hoodie': os.path.join(base_dir, 'memes', 'cheetah_hoodie.png'),
    'magic_eden': os.path.join(base_dir, 'memes', 'magic_eden_clothes.png'),
    'french_stripes': os.path.join(base_dir, 'memes', 'french_stripes.png'),
    'cats_shirt': os.path.join(base_dir, 'memes', 'cats_shirt.png'),
    '49ers': os.path.join(base_dir, 'memes', '49ers.png'),
    'chiefs': os.path.join(base_dir, 'memes', 'chiefs.png'),
    'applied_primate_coat': os.path.join(base_dir, 'memes', 'applied_primate_coat.png'),
    'btc_hoodie': os.path.join(base_dir, 'memes', 'btc_hoodie.png'),
    'bape_coach': os.path.join(base_dir, 'memes', 'bape_coach.png'),
    'bape_shirt': os.path.join(base_dir, 'memes', 'bape_shirt.png'),
    'jacket': os.path.join(base_dir, 'memes', 'jacket.png'),
    'bape_hoodie_red': os.path.join(base_dir, 'memes', 'bape_hoodie_red.png'),
    'bape_hoodie_green': os.path.join(base_dir, 'memes', 'bape_hoodie_green.png'),
    'adidas_hoodie': os.path.join(base_dir, 'memes', 'adidas_hoodie.png'),
    'adidas_yellow': os.path.join(base_dir, 'memes', 'adidas_yellow.png'),
    'sweater': os.path.join(base_dir, 'memes', 'sweater.png'),
    'blazer': os.path.join(base_dir, 'memes', 'blazer.png'),
    'naked': os.path.join(base_dir, '_blank.png'),
    'singe_hoodie': os.path.join(base_dir, 'memes', 'singe_hoodie.png'),
    'singe_hoodie_glow': os.path.join(base_dir, 'memes', 'singe_hoodie_glow.png'),
    'singe_hoodie_robot': os.path.join(base_dir, 'memes', 'singe_hoodie_robot.png'),
    'singe_hoodie_glow_robot': os.path.join(base_dir, 'memes', 'singe_hoodie_glow_robot.png')
}

main_assets = {
    'sardines': os.path.join(base_dir, 'memes', 'sardines.png'),
    'ramen': os.path.join(base_dir, 'memes', 'ramen.png'),
    'pipe': os.path.join(base_dir, 'memes', 'pipe.png'),
    'thumbsup': os.path.join(base_dir, 'memes', 'thumbsup.png'),
    'magic_eden': os.path.join(base_dir, 'memes', 'magic_eden_hand.png'),
    'gm_espresso': os.path.join(base_dir, 'memes', 'gm_espresso.png'),
    'banana': os.path.join(base_dir, 'memes', 'banana_hand.png'),
    'otherside': os.path.join(base_dir, 'memes', 'otherside.png'),
    'cheers': os.path.join(base_dir, 'memes', 'cheers.png'),
    'candle': os.path.join(base_dir, 'memes', 'candle.png'),
    'apecoin_hands1': os.path.join(base_dir, 'memes', 'apecoin_hands1.png'),
    'apecoin_hands2': os.path.join(base_dir, 'memes', 'apecoin_hands2.png'),
    'shoe': os.path.join(base_dir, 'memes', 'bape_shoe.png'),
    'peace': os.path.join(base_dir, 'memes', 'peace.png'),
    'baguette': os.path.join(base_dir, 'memes', 'baguette.png'),
    'balloon_moon': os.path.join(base_dir, 'memes', 'balloon_moon.png'),
    'clubhouse': os.path.join(base_dir, 'memes', 'clubhouse.png'),
    'moon_coffee': os.path.join(base_dir, 'memes', 'moon_coffee.png'),
    'fireworks': os.path.join(base_dir, 'memes', 'fireworks.png'),
    'balloon_fireworks': os.path.join(base_dir, 'memes', 'balloon_fireworks.png'),
    'matchstick': os.path.join(base_dir, 'memes', 'matchstick.png')
    # Add more asset types here as needed
}

mouth_assets = {
    'big_smile': os.path.join(base_dir, 'memes', 'smile', 'big_smile.png'),
    'multicolor_smile': os.path.join(base_dir, 'memes', 'smile', 'multicolor.png'),
    'diamond_smile': os.path.join(base_dir, 'memes', 'smile', 'diamond.png'),
    'gold_smile': os.path.join(base_dir, 'memes', 'smile', 'gold.png'),
    'unshaven_smile': os.path.join(base_dir, 'memes', 'smile', 'unshaven.png'),
    'doodles_rainbow': os.path.join(base_dir, 'memes', 'doodles_rainbow.png'),
    'tree': os.path.join(base_dir, 'memes', 'tree.png'),
    'tree_unshaven': os.path.join(base_dir, 'memes', 'tree_unshaven.png')
    # Add more asset types here as needed
}

hat_assets = {
    'cats_hat': os.path.join(base_dir, 'memes', 'cats_hat.png'),
    'beret': os.path.join(base_dir, 'memes', 'beret.png'),
    'pudgy_hat': os.path.join(base_dir, 'memes', 'pudgy_hat.png'),
    'pudgy_hat2': os.path.join(base_dir, 'memes', 'pudgy_hat2.png'),
    'plunger': os.path.join(base_dir, 'memes', 'plunger.png'),
    'christmas_hat': os.path.join(base_dir, 'memes', 'christmas_hat.png'),
    'christmas_hat2': os.path.join(base_dir, 'memes', 'christmas_hat2.png'),
    'christmas_hat3': os.path.join(base_dir, 'memes', 'christmas_hat3.png'),
    'glitter_cowboy_hat': os.path.join(base_dir, 'memes', 'glitter_cowboy_hat.png')
}

eyes_assets = {
    'btc_eyes': os.path.join(base_dir, 'memes', 'btc_eyes.png'),
    'dookey_eyes': os.path.join(base_dir, 'memes', 'dookey_eyes.png'),
    'star_glasses': os.path.join(base_dir, 'memes', 'star_glasses.png'),
    'vision_pro': os.path.join(base_dir, 'memes', 'vision_pro.png')
}

club_assets = {
    'dubai': os.path.join(base_dir, 'memes', 'dubai.png'),
    'elite': os.path.join(base_dir, 'memes', 'elite.png')
}

additional_assets = {
    'unclogged': os.path.join(base_dir, 'memes', 'unclogged.png'),
    'magic_eden_front': os.path.join(base_dir, 'memes', 'magic_eden_front.png'),
    'magic_eden_bg': os.path.join(base_dir, 'memes', 'magic_eden_bg.png'),
    'hex_dark': os.path.join(base_dir, 'memes', 'hex_dark.png'),
    'hex_light': os.path.join(base_dir, 'memes', 'hex_light.png'),
    'small_ape': 'resize_to_small', 
    'snow': os.path.join(base_dir, 'memes', 'snow.png'),
    'confetti': os.path.join(base_dir, 'memes', 'confetti.png'),
    'verified': os.path.join(base_dir, 'memes', 'mask2.png'),
    'transparent': os.path.join(base_dir, '_blank.png'),
    'selfie': os.path.join(base_dir, '_blank.png'),
    'head_black': os.path.join(base_dir, 'Heads', 'head_black.png'),
    'head_blue': os.path.join(base_dir, 'Heads', 'head_blue.png'),
    'head_brown': os.path.join(base_dir, 'Heads', 'head_brown.png'),
    'head_cheetah': os.path.join(base_dir, 'Heads', 'head_cheetah.png'),
    'head_cream': os.path.join(base_dir, 'Heads', 'head_cream.png'),
    'head_dark_brown': os.path.join(base_dir, 'Heads', 'head_dark_brown.png'),
    'head_death_bot': os.path.join(base_dir, 'Heads', 'head_death_bot.png'),
    'head_dmt': os.path.join(base_dir, 'Heads', 'head_dmt.png'),
    'head_golden_brown': os.path.join(base_dir, 'Heads', 'head_golden_brown.png'),
    'head_gray': os.path.join(base_dir, 'Heads', 'head_gray.png'),
    'head_noise': os.path.join(base_dir, 'Heads', 'head_noise.png'),
    'head_pink': os.path.join(base_dir, 'Heads', 'head_pink.png'),
    'head_red': os.path.join(base_dir, 'Heads', 'head_red.png'),
    'head_robot': os.path.join(base_dir, 'Heads', 'head_robot.png'),
    'head_solid_gold': os.path.join(base_dir, 'Heads', 'head_solid_gold.png'),
    'head_tan': os.path.join(base_dir, 'Heads', 'head_tan.png'),
    'head_trippy': os.path.join(base_dir, 'Heads', 'head_trippy.png'),
    'head_white': os.path.join(base_dir, 'Heads', 'head_white.png'),
    'head_zombie': os.path.join(base_dir, 'Heads', 'head_zombie.png'),
    'hoodie_black': os.path.join(base_dir, 'Hoodie_Fur', 'Black.png'),
    'hoodie_blue': os.path.join(base_dir, 'Hoodie_Fur', 'Blue.png'),
    'hoodie_brown': os.path.join(base_dir, 'Hoodie_Fur', 'Brown.png'),
    'hoodie_cheetah': os.path.join(base_dir, 'Hoodie_Fur', 'Cheetah.png'),
    'hoodie_cream': os.path.join(base_dir, 'Hoodie_Fur', 'Cream.png'),
    'hoodie_dark_brown': os.path.join(base_dir, 'Hoodie_Fur', 'Dark Brown.png'),
    'hoodie_dmt': os.path.join(base_dir, 'Hoodie_Fur', 'Dmt.png'),
    'hoodie_golden_brown': os.path.join(base_dir, 'Hoodie_Fur', 'Golden Brown.png'),
    'hoodie_gray': os.path.join(base_dir, 'Hoodie_Fur', 'Gray.png'),
    'hoodie_noise': os.path.join(base_dir, 'Hoodie_Fur', 'Noise.png'),
    'hoodie_pink': os.path.join(base_dir, 'Hoodie_Fur', 'Pink.png'),
    'hoodie_red': os.path.join(base_dir, 'Hoodie_Fur', 'Red.png'),
    'hoodie_solid_gold': os.path.join(base_dir, 'Hoodie_Fur', 'Solid Gold.png'),
    'hoodie_tan': os.path.join(base_dir, 'Hoodie_Fur', 'Tan.png'),
    'hoodie_trippy': os.path.join(base_dir, 'Hoodie_Fur', 'Trippy.png'),
    'hoodie_white': os.path.join(base_dir, 'Hoodie_Fur', 'White.png'),
    'hoodie_zombie': os.path.join(base_dir, 'Hoodie_Fur', 'Zombie.png'),
    'hoodie_robot': os.path.join(base_dir, 'Hoodie_Fur', 'Robot.png'),
    'hoodie_death_bot': os.path.join(base_dir, 'Hoodie_Fur', 'Death Bot.png'),
    'background_glow': os.path.join(base_dir, 'memes', 'background_glow.png')
    # Add more assets as needed
}

# RGB values for each color name
color_map = {
    "Aquamarine": (86, 183, 150, 0.4),
    "Army Green": (90, 90, 48, 0.4),
    "Blue": (142, 183, 195, 0.4),
    "Gray": (164, 165, 166, 0.4),
    "New Punk Blue": (55, 81, 98, 0.4),
    "Orange": (182, 123, 56, 0.4),
    "Purple": (87, 75, 89, 0.4),
    "Yellow": (180, 180, 137, 0.4)
}

def get_image_file(trait_type, value):
    if value in special_assets:
        path = special_assets[value]
        print(f"Accessing special asset: {path}")
        return path
    elif value in mouth_assets:
        path = mouth_assets[value]
        print(f"Accessing mouth asset: {path}")
        return path
    elif value in eyes_assets:
        path = eyes_assets[value]
        print(f"Accessing eyes asset: {path}")
        return path
    elif value in hat_assets:
        path = hat_assets[value]
        print(f"Accessing hat asset: {path}")
        return path
    elif value in club_assets:
        path = club_assets[value]
        print(f"Accessing club asset: {path}")
        return path
    elif value in additional_assets:
        path = additional_assets[value]
        print(f"Accessing selfie asset: {path}")
        return path
    elif value:
        path = os.path.join(base_dir, trait_type, f"{value}.png")
        return path
    else:
        path = os.path.join(base_dir, "_blank.png")
        print(f"Accessing fallback asset: {path}")
        return path
    
def add_asset(image, asset_type, asset_dict):
    asset_path = asset_dict.get(asset_type, os.path.join(base_dir, '_blank.png'))
    print(f"Adding asset: {asset_path}")
    try:
        with Image.open(asset_path).convert("RGBA") as asset_image:
            image.alpha_composite(asset_image, (0, 0))
    except FileNotFoundError:
        print(f"File not found: {asset_path}")
    return image
    
def is_minted(token_id):
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'afa_db.json')
        with open(db_path, 'r') as file:
            minted_apes = json.load(file)
        return token_id in [ape['TOKENID'] for ape in minted_apes]
    except Exception as e:
        app.logger.error(f"Error in is_minted: {e}")
        return False@app.route('/api/get-asset', methods=['GET'])
    

# Modify this function to return a list of elite token IDs as strings
def load_elite_ids():
    elite_path = os.path.join(os.path.dirname(__file__), 'elite.json')
    with open(elite_path, 'r') as file:
        elite_data = json.load(file)
    return [str(item['TOKENID']) for item in elite_data]

elite_ids = load_elite_ids()

# Modify this function to return a list of dubai token IDs as strings
def load_dubai_ids():
    dubai_path = os.path.join(os.path.dirname(__file__), 'dubai.json')
    with open(dubai_path, 'r') as file:
        dubai_data = json.load(file)
    return [str(item['TOKENID']) for item in dubai_data]

dubai_ids = load_dubai_ids()


def compose_ape(ape_id, data, asset_type, second_asset_type, third_asset_type, mouth_asset_type, hat_asset_type, eyes_asset_type, club_asset_type):
    ape = next((item for item in data["apes"] if str(item["id"]) == ape_id), None)
    if not ape:
        print(f"No ape found with id: {ape_id}")
        return None
        

    attributes = ape["metadata"]["attributes"]
    final_image = Image.new("RGBA", (1000, 1000), (255, 255, 255, 0))
    
    layers = {}

    # Check if elite asset is selected
    is_elite_selected = club_asset_type == 'elite'
    # Check if dubai asset is selected
    is_dubai_selected = club_asset_type == 'dubai'

    
    # Flags for asset additions
    clothes_added = False
    mouth_added = False
    hat_added = False
    background_transparent = False
    head_added = False
    eyes_added = False

    # Conditions for specific types of 'big_smile'
    has_black_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Black" for attr in attributes)
    has_blue_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Blue" for attr in attributes)
    has_brown_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Brown" for attr in attributes)
    has_cheetah_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Cheetah" for attr in attributes)
    has_cream_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Cream" for attr in attributes)
    has_dark_brown_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Dark Brown" for attr in attributes)
    has_death_bot_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Death Bot" for attr in attributes)
    has_dmt_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Dmt" for attr in attributes)
    has_golden_brown_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Golden Brown" for attr in attributes)
    has_gray_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Gray" for attr in attributes)
    has_noise_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Noise" for attr in attributes)
    has_pink_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Pink" for attr in attributes)
    has_red_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Red" for attr in attributes)
    has_robot_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Robot" for attr in attributes)
    has_solid_gold_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Solid Gold" for attr in attributes)
    has_tan_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Tan" for attr in attributes)
    has_trippy_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Trippy" for attr in attributes)
    has_white_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "White" for attr in attributes)
    has_zombie_fur = any(attr["trait_type"] == "Fur" and attr["value"] == "Zombie" for attr in attributes)
    has_blue_beams = any(attr["trait_type"] == "Eyes" and attr["value"] == "Blue Beams" for attr in attributes)
        
    has_multicolor_smile = any(attr["trait_type"] == "Mouth" and attr["value"] == "Grin Multicolored" for attr in attributes)
    has_diamond_smile = any(attr["trait_type"] == "Mouth" and attr["value"] == "Grin Diamond Grill" for attr in attributes)
    has_gold_smile = any(attr["trait_type"] == "Mouth" and attr["value"] == "Grin Gold Grill" for attr in attributes)
    has_unshaven_mouth = any(attr["trait_type"] == "Mouth" and attr["value"] in {
        "Bored Unshaven Bubblegum",
        "Bored Unshaven Cigar",
        "Bored Unshaven Cigarette",
        "Bored Unshaven Dagger",
        "Bored Unshaven Kazoo",
        "Bored Unshaven Party horn",
        "Bored Unshaven Pipe",
        "Bored Unshaven Pizza",
        "Bored Unshaven"
    } for attr in attributes)

    specific_hats = {
        "Short Mohawk",
        "Girl's Hair Pink",
        "Girl's Hair Short",
        "Commie Hat",
        "Laurel Wreath",
        "christmas_hat",
        "christmas_hat2",
        "christmas_hat3"
    }

    has_crazy_eyes = any(attr["trait_type"] == "Eyes" and attr["value"] == "Crazy" for attr in attributes)
    has_specific_hat = any(attr["trait_type"] == "Hat" and attr["value"] in specific_hats for attr in attributes)
    
    # Check if the selected hat asset is in the specific hats list
    has_selected_specific_hat = hat_asset_type in specific_hats

    # Resize the composed ape (excluding background) if elite asset is selected
    if is_elite_selected:
        ape_composed = final_image.copy()
        ape_composed = ape_composed.resize((int(1000 * 0.7), int(1000 * 0.7)), Image.ANTIALIAS)
        final_image.paste(ape_composed, (int(1000 * 0.15), int(1000 * 0.15)), ape_composed)

    # Determine the specific 'big_smile' asset based on conditions
    specific_smile = None
    if has_multicolor_smile:
        specific_smile = 'multicolor_smile'
    elif has_diamond_smile:
        specific_smile = 'diamond_smile'
    elif has_gold_smile:
        specific_smile = 'gold_smile'
    elif has_unshaven_mouth:
        specific_smile = 'unshaven_smile'
    
    specific_head = None
    if has_black_fur:
        specific_head = 'head_black'
        hoodie_head = 'hoodie_black'
    elif has_blue_fur:
        specific_head = 'head_blue'
        hoodie_head = 'hoodie_blue'
    elif has_brown_fur:
        specific_head = 'head_brown'
        hoodie_head = 'hoodie_brown'
    elif has_cheetah_fur:
        specific_head = 'head_cheetah'
        hoodie_head = 'hoodie_brown'
    elif has_cream_fur:
        specific_head = 'head_cream'
        hoodie_head = 'hoodie_cream'
    elif has_dark_brown_fur:
        specific_head = 'head_dark_brown'
        hoodie_head = 'hoodie_dark_brown'
    elif has_death_bot_fur:
        specific_head = 'head_death_bot'
        hoodie_head = 'hoodie_death_bot'
    elif has_dmt_fur:
        specific_head = 'head_dmt'
        hoodie_head = 'hoodie_dmt'
    elif has_golden_brown_fur:
        specific_head = 'head_golden_brown'
        hoodie_head = 'hoodie_golden_brown'
    elif has_gray_fur:
        specific_head = 'head_gray'
        hoodie_head = 'hoodie_gray'
    elif has_noise_fur:
        specific_head = 'head_noise'
        hoodie_head = 'hoodie_noise'
    elif has_pink_fur:
        specific_head = 'head_pink'
        hoodie_head = 'hoodie_pink'
    elif has_red_fur:
        specific_head = 'head_red'
        hoodie_head = 'hoodie_red'
    elif has_robot_fur:
        specific_head = 'head_robot'
        hoodie_head = 'hoodie_robot'
    elif has_solid_gold_fur:
        specific_head = 'head_solid_gold'
        hoodie_head = 'hoodie_solid_gold'
    elif has_tan_fur:
        specific_head = 'head_tan'
        hoodie_head = 'hoodie_tan'
    elif has_trippy_fur:
        specific_head = 'head_trippy'
        hoodie_head = 'hoodie_trippy'
    elif has_white_fur:
        specific_head = 'head_white'
        hoodie_head = 'hoodie_white'
    elif has_zombie_fur:
        specific_head = 'head_zombie'
        hoodie_head = 'hoodie_zombie'


    specific_tree = None
    if has_unshaven_mouth:
        specific_tree = 'tree_unshaven'
    
    # else use the default 'big_smile'

    # Loop through attributes and compose image
    for attribute in attributes:
        trait_type = attribute["trait_type"]
        value = attribute["value"]

    
        if trait_type == "Background" and third_asset_type == 'transparent':
            print("Applying transparent background")
            image_path = additional_assets['transparent']
            background_transparent = True
        elif trait_type == "Background" and third_asset_type == 'selfie':
            print("Applying transparent background")
            image_path = additional_assets['selfie']
        elif trait_type == "Fur" and third_asset_type == 'selfie':
            print("Applying Head")
            image_path = additional_assets[specific_head if specific_head in additional_assets else 'transparent']
            head_added = True
        elif trait_type == "Fur" and second_asset_type == 'singe_hoodie':
            image_path = additional_assets[hoodie_head if hoodie_head in additional_assets else 'transparent']
        elif trait_type == "Fur" and second_asset_type == 'singe_hoodie_glow':
            image_path = additional_assets[hoodie_head if hoodie_head in additional_assets else 'transparent']
        elif trait_type == "Hat" and second_asset_type == 'singe_hoodie':
            image_path = additional_assets['transparent']
        elif trait_type == "Hat" and second_asset_type == 'singe_hoodie_glow':
            image_path = additional_assets['transparent']
        elif trait_type == "Earring" and second_asset_type == 'singe_hoodie':
            image_path = additional_assets['transparent']
        elif trait_type == "Earring" and second_asset_type == 'singe_hoodie_glow':
            image_path = additional_assets['transparent']
        elif trait_type == "Background" and second_asset_type == 'singe_hoodie_glow':
            image_path = additional_assets['background_glow']
        elif third_asset_type == 'magic_eden':
            image_path = additional_assets['magic_eden_front']
        elif trait_type == "Background" and club_asset_type == 'elite':
            # If elite asset is selected, use a black background
            print("Applying black background for elite asset")
            image_path = additional_assets['transparent']  # Use transparent as placeholder
            background_black = True
        elif trait_type == "Hat" and club_asset_type == 'dubai':
            # If dubai asset is selected, use a black background
            print("Replacing the Hat for dubai asset")
            image_path = additional_assets['transparent']  # Use transparent as placeholder
        elif trait_type == "Mouth" and club_asset_type == 'dubai':
            # If dubai asset is selected, use a black background
            print("Overlay mouth layer")
            image_path = os.path.join(base_dir, 'Mouth', f"{value}.png")
        elif trait_type == "Background" and not background_transparent:
            image_path = get_image_file(trait_type, value)
        elif trait_type == "Background" and not background_transparent:
            image_path = get_image_file(trait_type, value)
        elif trait_type == "Clothes" and second_asset_type in special_assets and not clothes_added:
            print(f"Replacing clothes with special asset: {second_asset_type}")
            image_path = special_assets[second_asset_type]
            clothes_added = True
        elif trait_type == "Eyes":
            if eyes_asset_type == 'star_glasses':
                # Fetch eyes from the memes/silvester_eyes folder
                image_path = os.path.join(base_dir, 'memes', 'silvester_eyes', f"{value}.png")
            elif eyes_asset_type in eyes_assets and not eyes_added:
                print(f"Replacing Eyes with eyes asset: {eyes_asset_type}")
                image_path = eyes_assets[eyes_asset_type]
            else:
                # Fetch eyes from the regular eyes folder
                image_path = os.path.join(base_dir, 'Eyes', f"{value}.png")
            eyes_added = True
        elif trait_type == "Hat" and hat_asset_type in hat_assets and not hat_added:
            print(f"Replacing hat with hat asset: {hat_asset_type}")
            image_path = hat_assets[hat_asset_type]
            hat_added = True
        elif trait_type == "Clothes" and third_asset_type == 'selfie':
            print("Applying no Clothes")
            image_path = additional_assets['selfie']
            head_added = True
        elif trait_type == "Clothes"and third_asset_type == 'selfie' and clothes_added:
            print("Applying no Clothes")
            image_path = additional_assets['selfie']
            head_added = True
        elif trait_type == "Mouth" and not mouth_added:
            if mouth_asset_type == 'big_smile':
                image_path = mouth_assets[specific_smile if specific_smile in mouth_assets else 'big_smile']
            elif mouth_asset_type == 'doodles_rainbow':
                image_path = mouth_assets['doodles_rainbow']
            else:
                image_path = get_image_file(trait_type, value)
        else:
            image_path = get_image_file(trait_type, value)

        try:
            with Image.open(image_path).convert("RGBA") as img:
                layers[trait_type] = img.copy()
        except FileNotFoundError:
            print(f"File not found for trait_type {trait_type}, value {value}: {image_path}")


    # Composite all the layers onto the final image
    for layer_type in ['Background', 'Fur', 'Eyes', 'Clothes', 'Earring', 'Hat', 'Mouth']:
        if layer_type in layers:
            final_image.alpha_composite(layers[layer_type], (0, 0))

 


   


    # Add clothes asset if it wasn't added and is selected
    if second_asset_type in special_assets and not clothes_added:
        print(f"Adding selected clothes asset: {second_asset_type}")
        add_asset(final_image, second_asset_type, special_assets)


    
    # Add hat asset if it wasn't added and is selected
    if hat_asset_type in hat_assets and not hat_added:
        print(f"Adding selected hat asset: {hat_asset_type}")
        add_asset(final_image, hat_asset_type, hat_assets)
    


    if has_crazy_eyes and (has_specific_hat or has_selected_specific_hat):
        crazy_left_eye_path = os.path.join(base_dir, "Special Cases/Eyes/Crazy Left Eye.png")
        try:
            with Image.open(crazy_left_eye_path).convert("RGBA") as crazy_left_eye:
                final_image.alpha_composite(crazy_left_eye, (0, 0))
        except FileNotFoundError:
            print(f"File not found for Crazy Left Eye: {crazy_left_eye_path}")
   
    
    
    if (has_robot_fur or has_death_bot_fur) and second_asset_type ==  'singe_hoodie':
        hoodie_path = special_assets['singe_hoodie_robot']
        try:
            with Image.open(hoodie_path).convert("RGBA") as hoodie:
                final_image.alpha_composite(hoodie, (0, 0))
        except FileNotFoundError:
            print(f"File not found for Crazy Left Eye: {hoodie_path}")
    if (has_robot_fur or has_death_bot_fur) and second_asset_type ==  'singe_hoodie_glow':
        hoodie_glow_path = special_assets['singe_hoodie_glow_robot']
        try:
            with Image.open(hoodie_glow_path).convert("RGBA") as hoodie:
                final_image.alpha_composite(hoodie, (0, 0))
        except FileNotFoundError:
            print(f"File not found for Crazy Left Eye: {hoodie_path}")

    if has_blue_beams:
        blue_beams_path = os.path.join(base_dir, "Special Cases/Eyes/Blue Beams.png")
        try:
            with Image.open(blue_beams_path).convert("RGBA") as blue_beams:
                final_image.alpha_composite(blue_beams, (0, 0))
        except FileNotFoundError:
            print(f"File not found for Blue Beams: {blue_beams_path}")

    # Composite all the layers onto the final image
    for layer_type in ['Mouth']:
        if layer_type in layers:
            final_image.alpha_composite(layers[layer_type], (0, 0))

    # Apply elite asset logic
    if is_elite_selected:
        # Resize to 70% and set black background
        resized_ape = final_image.resize((int(1000 * 0.7), int(1000 * 0.7)), Image.ANTIALIAS)
        final_image = Image.new("RGBA", (1000, 1000), (0, 0, 0, 255))
        final_image.paste(resized_ape, (int(1000 * 0.15), int(1000 * 0.15)), resized_ape)

    # Add club asset if it wasn't added and is selected
    if club_asset_type in club_assets:
        print(f"Adding selected club asset: {club_asset_type}")
        add_asset(final_image, club_asset_type, club_assets)
    # Add Dubai asset if it is selected
    if is_dubai_selected:
        print(f"Adding Dubai asset: {club_assets['dubai']}")
        add_asset(final_image, 'dubai', club_assets)
    # Composite all the layers onto the final image
        for layer_type in ['Mouth']:
            if layer_type in layers:
                final_image.alpha_composite(layers[layer_type], (0, 0))

    # Add main asset if specified
    if asset_type in main_assets:
        print(f"Adding main asset: {asset_type}")
        add_asset(final_image, asset_type, main_assets)

    # Add third asset if specified
    if third_asset_type in additional_assets:
        print(f"Adding third asset: {third_asset_type}")
        add_asset(final_image, third_asset_type, additional_assets)

  

     # Check if 'small_ape' is selected
    if third_asset_type == 'small_ape':
        # Resize logic for the ape image
        scale_factor = 0.3  # Example scale factor
        resized_width = int(final_image.width * scale_factor)
        resized_height = int(final_image.height * scale_factor)
        resized_ape = final_image.resize((resized_width, resized_height), Image.ANTIALIAS)

        # Create a new canvas and place the resized ape in the center
        final_image = Image.new("RGBA", (1000, 1000), (255, 255, 255, 0))
        position_x = (final_image.width - resized_width) // 2
        position_y = (final_image.height - resized_height)
        for layer_type in ['Background']:
            if layer_type in layers:
                final_image.alpha_composite(layers[layer_type], (0, 0))
        final_image.paste(resized_ape, (position_x, position_y), resized_ape)


    return final_image
    

@app.route('/api/get-asset', methods=['GET'])
def get_asset():
    token_id = request.args.get('tokenId')
    asset_type = request.args.get('assetType', '')
    second_asset_type = request.args.get('secondAssetType', '')
    third_asset_type = request.args.get('thirdAssetType', '')
    mouth_asset_type = request.args.get('mouthAssetType', '')
    hat_asset_type = request.args.get('hatAssetType', '')
    eyes_asset_type = request.args.get('eyesAssetType', '')
    token_id = request.args.get('tokenId')
    club_asset_type = request.args.get('clubAssetType', '')

    # Check if elite asset is requested and if token_id is not in elite list
    if club_asset_type == 'elite' and token_id not in elite_ids:
        # Return a message indicating the token ID is not eligible for elite assets
        return jsonify({'error': 'Token ID not eligible for elite assets'}), 200
    # Check if elite asset is requested and if token_id is not in elite list
    if club_asset_type == 'dubai' and token_id not in dubai_ids:
        # Return a message indicating the token ID is not eligible for elite assets
        return jsonify({'error': 'Token ID not eligible for dubai assets'}), 200

    try:
        if is_minted(token_id):
            db_path = os.path.join(os.path.dirname(__file__), 'db.json')
            with open(db_path, 'r') as file:
                data = json.load(file)
            
            image = compose_ape(token_id, data, asset_type, second_asset_type, third_asset_type, mouth_asset_type, hat_asset_type, eyes_asset_type, club_asset_type)
            if not image:
                raise ValueError("Ape not found")
            img_io = BytesIO()
            image.save(img_io, 'PNG')
            img_io.seek(0)
            return send_file(img_io, mimetype='image/png')
        else:
            default_image_url = url_for('static', filename='/face.png')
            return jsonify({'image_url': default_image_url, 'message': 'This ape has not changed their perspective yet'})
    
    except Exception as e:
        print(f"Error processing Token ID {token_id}: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/api/get-background-color', methods=['GET'])
def get_background_color():
    token_id = request.args.get('tokenId')
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'db.json')
        with open(db_path, 'r') as file:
            data = json.load(file)
            ape = next((item for item in data["apes"] if str(item["id"]) == token_id), None)
            if ape:
                background_color = next((attr['value'] for attr in ape["metadata"]["attributes"] if attr['trait_type'] == 'Background'), 'Default')
                rgba = color_map.get(background_color, (0, 0, 0, 1))
                print(f"Background color RGB for token ID {token_id}: {rgba}")
                return jsonify({'background_color': rgba})
            else:
                raise ValueError("Ape not found")
    except Exception as e:
        print(f"Error processing Token ID {token_id}: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500
    
@app.route('/api/token-ids', methods=['GET'])
def get_token_ids():
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'afa_db.json')
        with open(db_path, 'r') as file:
            minted_apes = json.load(file)
        return jsonify([ape['TOKENID'] for ape in minted_apes])
    except Exception as e:
        app.logger.error(f"Error in get_token_ids: {e}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/elite-token-ids', methods=['GET'])
def get_elite_token_ids():
    try:
        elite_path = os.path.join(os.path.dirname(__file__), 'elite.json')
        with open(elite_path, 'r') as file:
            elite_ids = json.load(file)
        return jsonify([ape['TOKENID'] for ape in elite_ids])
    except Exception as e:
        print(f"Error in get_elite_token_ids: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/api/dubai-token-ids', methods=['GET'])
def get_dubai_token_ids():
    try:
        dubai_path = os.path.join(os.path.dirname(__file__), 'dubai.json')
        with open(dubai_path, 'r') as file:
            dubai_ids = json.load(file)
        return jsonify([ape['TOKENID'] for ape in dubai_ids])
    except Exception as e:
        print(f"Error in get_dubai_token_ids: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/', defaults={'path': ''})

@app.route('/<path:path>')
def catch_all(path):
    # Serve static files from the React app's public folder
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        # Serve index.html for all other routes to enable SPA routing
        return send_from_directory(app.static_folder, '/index.html')

if __name__ == '__main__':
    app.run(debug=True)