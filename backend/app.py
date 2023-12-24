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
    'bape_coach': os.path.join(base_dir, 'memes', 'bape_coach.png'),
    'bape_shirt': os.path.join(base_dir, 'memes', 'bape_shirt.png'),
    'jacket': os.path.join(base_dir, 'memes', 'jacket.png'),
    'bape_hoodie_red': os.path.join(base_dir, 'memes', 'bape_hoodie_red.png'),
    'bape_hoodie_green': os.path.join(base_dir, 'memes', 'bape_hoodie_green.png'),
    'adidas_hoodie': os.path.join(base_dir, 'memes', 'adidas_hoodie.png'),
    'adidas_yellow': os.path.join(base_dir, 'memes', 'adidas_yellow.png'),
    'sweater': os.path.join(base_dir, 'memes', 'sweater.png'),
    'naked': os.path.join(base_dir, '_blank.png')
}

main_assets = {
    'cheers': os.path.join(base_dir, 'memes', 'cheers.png'),
    'shoe': os.path.join(base_dir, 'memes', 'bape_shoe.png'),
    'peace': os.path.join(base_dir, 'memes', 'peace.png')
    # Add more asset types here as needed
}

mouth_assets = {
    'big_smile': os.path.join(base_dir, 'memes', 'smile', 'big_smile.png'),
    'multicolor_smile': os.path.join(base_dir, 'memes', 'smile', 'multicolor.png'),
    'diamond_smile': os.path.join(base_dir, 'memes', 'smile', 'diamond.png'),
    'gold_smile': os.path.join(base_dir, 'memes', 'smile', 'gold.png'),
    'unshaven_smile': os.path.join(base_dir, 'memes', 'smile', 'unshaven.png'),
    'tree': os.path.join(base_dir, 'memes', 'tree.png'),
    'tree_unshaven': os.path.join(base_dir, 'memes', 'tree_unshaven.png')
    # Add more asset types here as needed
}

additional_assets = {
    'snow': os.path.join(base_dir, 'memes', 'snow.png'),
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
    'head_zombie': os.path.join(base_dir, 'Heads', 'head_zombie.png')
    # Add more assets as needed
}

# RGB values for each color name
color_map = {
    "Aquamarine": (107, 227, 186),
    "Army Green": (112, 113, 61),
    "Blue": (176, 227, 242),
    "Gray": (204, 205, 206),
    "New Punk Blue": (69, 102, 122),
    "Orange": (226, 153, 70),
    "Purple": (108, 94, 111),
    "Yellow": (224, 223, 171)
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
    elif value in additional_assets:
        path = additional_assets[value]
        print(f"Accessing selfie asset: {path}")
        return path
    elif value:
        path = os.path.join(base_dir, trait_type, f"{value}.png")
        print(f"Accessing regular trait: {path}")
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

def compose_ape(ape_id, data, asset_type, second_asset_type, third_asset_type, mouth_asset_type):
    ape = next((item for item in data["apes"] if str(item["id"]) == ape_id), None)
    if not ape:
        print(f"No ape found with id: {ape_id}")
        return None
        

    attributes = ape["metadata"]["attributes"]
    final_image = Image.new("RGBA", (1000, 1000), (255, 255, 255, 0))
    layers = {}
    clothes_added = False
    mouth_added = False  # Flag to check if mouth asset has been added
    background_transparent = False
    head_added = False

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
    elif has_blue_fur:
        specific_head = 'head_blue'
    elif has_brown_fur:
        specific_head = 'head_brown'
    elif has_cheetah_fur:
        specific_head = 'head_cheetah'
    elif has_cream_fur:
        specific_head = 'head_cream'
    elif has_dark_brown_fur:
        specific_head = 'head_dark_brown'
    elif has_death_bot_fur:
        specific_head = 'head_death_bot'
    elif has_dmt_fur:
        specific_head = 'head_dmt'
    elif has_golden_brown_fur:
        specific_head = 'head_golden_brown'
    elif has_gray_fur:
        specific_head = 'head_gray'
    elif has_noise_fur:
        specific_head = 'head_noise'
    elif has_pink_fur:
        specific_head = 'head_pink'
    elif has_red_fur:
        specific_head = 'head_red'
    elif has_robot_fur:
        specific_head = 'head_robot'
    elif has_solid_gold_fur:
        specific_head = 'head_solid_gold'
    elif has_tan_fur:
        specific_head = 'head_tan'
    elif has_trippy_fur:
        specific_head = 'head_trippy'
    elif has_white_fur:
        specific_head = 'head_white'
    elif has_zombie_fur:
        specific_head = 'head_zombie'
   
   
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
            head_added = True
        elif trait_type == "Fur" and third_asset_type == 'selfie':
            print("Applying Head")
            image_path = additional_assets[specific_head if specific_head in additional_assets else 'transparent']
            head_added = True
        elif trait_type == "Background" and not background_transparent:
            image_path = get_image_file(trait_type, value)
        elif trait_type == "Background" and not background_transparent:
            image_path = get_image_file(trait_type, value)
        elif trait_type == "Clothes" and second_asset_type in special_assets and not clothes_added:
            print(f"Replacing clothes with special asset: {second_asset_type}")
            image_path = special_assets[second_asset_type]
            clothes_added = True
        elif trait_type == "Clothes" and third_asset_type == 'selfie':
            print("Applying no Clothes")
            image_path = additional_assets['selfie']
            head_added = True
        elif trait_type == "Clothes"and third_asset_type == 'selfie' and clothes_added:
            print("Applying no Clothes")
            image_path = additional_assets['selfie']
            head_added = True
        elif trait_type == "Mouth" and not mouth_added:
            mouth_added = True
            if mouth_asset_type == 'big_smile':
                image_path = mouth_assets[specific_smile if specific_smile in mouth_assets else 'big_smile']
            elif mouth_asset_type == 'tree':
                image_path = mouth_assets[specific_tree if specific_tree in mouth_assets else 'tree']
            else:
                image_path = get_image_file(trait_type, value)
        else:
            image_path = get_image_file(trait_type, value)

        try:
            with Image.open(image_path).convert("RGBA") as img:
                layers[trait_type] = img.copy()
        except FileNotFoundError:
            print(f"File not found for trait_type {trait_type}, value {value}: {image_path}")

    # Composite the layers onto the final image
    for layer_type in ['Background', 'Fur', 'Eyes', 'Clothes', 'Earring', 'Hat', 'Mouth']:
        if layer_type in layers:
            final_image.alpha_composite(layers[layer_type], (0, 0))

    # Add clothes asset if it wasn't added and is selected
    if second_asset_type in special_assets and not clothes_added:
        print(f"Adding selected clothes asset: {second_asset_type}")
        add_asset(final_image, second_asset_type, special_assets)

    # Add mouth asset if it wasn't added and is selected
    if mouth_asset_type in mouth_assets and not mouth_added:
        print(f"Adding selected mouth asset: {mouth_asset_type}")
        add_asset(final_image, mouth_asset_type, mouth_assets)

    # Add main asset if specified
    if asset_type in main_assets:
        print(f"Adding main asset: {asset_type}")
        add_asset(final_image, asset_type, main_assets)

    # Add third asset if specified
    if third_asset_type in additional_assets:
        print(f"Adding third asset: {third_asset_type}")
        add_asset(final_image, third_asset_type, additional_assets)

    return final_image
     

@app.route('/api/get-asset', methods=['GET'])
def get_asset():
    token_id = request.args.get('tokenId')
    asset_type = request.args.get('assetType', '')
    second_asset_type = request.args.get('secondAssetType', '')
    third_asset_type = request.args.get('thirdAssetType', '')
    mouth_asset_type = request.args.get('mouthAssetType', '')
    try:
        if is_minted(token_id):
            db_path = os.path.join(os.path.dirname(__file__), 'db.json')
            with open(db_path, 'r') as file:
                data = json.load(file)
            
            image = compose_ape(token_id, data, asset_type, second_asset_type, third_asset_type, mouth_asset_type)
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
                rgb = color_map.get(background_color, (0, 0, 0))
                print(f"Background color RGB for token ID {token_id}: {rgb}")
                return jsonify({'background_color': rgb})
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