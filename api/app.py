from flask import Flask, request, jsonify, send_file, send_from_directory
from PIL import Image
import json
import os
from io import BytesIO
from pathlib import Path

app = Flask(__name__)

# Base directory for the image files
base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'flask', 'traits')

special_assets = {
    'bape_coach': 'memes/bape_coach.png',
    'bape_hoodie_red': 'memes/bape_hoodie_red.png',
    'bape_hoodie_green': 'memes/bape_hoodie_green.png',
    'adidas_hoodie': 'memes/adidas_hoodie.png' ,
    'adidas_yellow': 'memes/adidas_yellow.png' ,
    'sweater': 'memes/sweater.png' 
}

main_assets = {
    'cheers': 'memes/cheers.png',
    'shoe': 'memes/bape_shoe.png',
    'peace': 'memes/peace.png'
    # Add more asset types here as needed
}

additional_assets = {
    'snow': 'memes/snow.png',
    'verified': 'memes/mask2.png'
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
    if value:
        return os.path.join(base_dir, trait_type, f"{value}.png")
    else:
        return os.path.join(base_dir, "_blank.png")
    
def is_minted(token_id):
    try:
        with open('../flask/afa_db.json', 'r') as file:
            minted_apes = json.load(file)
        # Check if token_id is in the list of minted apes
        return token_id in [ape['TOKENID'] for ape in minted_apes]
    except Exception as e:
        app.logger.error(f"Error in is_minted: {e}")
        return False  # or handle the exception as needed
    

def get_minted_apes():
    # Fetch the minted Ape tokens from your data source
    minted_apes = [{'TOKENID': '1'}, {'TOKENID': '2'}, {'TOKENID': '3'}]  # Replace with your fetched data
    return jsonify(minted_apes)

def compose_ape(ape_id, data, base_dir, asset_type, second_asset_type, third_asset_type):
    ape = next((item for item in data["apes"] if str(item["id"]) == ape_id), None)
    if not ape:
        return None

    attributes = ape["metadata"]["attributes"]
    final_image = Image.new("RGBA", (2000, 2000), (255, 255, 255, 0))
    layers = {}

    # Add Normal Layers
    for attribute in attributes:
        trait_type = attribute["trait_type"]
        value = attribute["value"]
        # Corrected call to get_image_file with two arguments
        with Image.open(get_image_file(trait_type, value)) as img:
            layers[trait_type] = img.copy()
   
    if second_asset_type in special_assets:
        special_asset_path = os.path.join(base_dir, special_assets[second_asset_type])
        with Image.open(special_asset_path).convert("RGBA") as special_image:
            layers['Clothes'] = special_image.copy()

    # Composite the layers onto the final image
    for layer_type in ['Background', 'Fur', 'Eyes', 'Clothes', 'Earring', 'Hat', 'Mouth']:
        if layer_type in layers:
            final_image.alpha_composite(layers[layer_type], (0, 0))

    if asset_type in main_assets:
        main_asset_path = os.path.join(base_dir, main_assets[asset_type])
        with Image.open(main_asset_path).convert("RGBA") as main_image:
            final_image.alpha_composite(main_image, (0, 0))

    if third_asset_type in additional_assets:
        additional_asset_path = os.path.join(base_dir, additional_assets[third_asset_type])
        with Image.open(additional_asset_path).convert("RGBA") as additional_image:
            final_image.alpha_composite(additional_image, (0, 0))
  
  
    return final_image


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    return send_from_directory('public', 'index.html')

@app.route('/get-asset', methods=['GET'])
def get_asset():
    token_id = request.args.get('tokenId')
    asset_type = request.args.get('assetType')
    second_asset_type = request.args.get('secondAssetType')
    third_asset_type = request.args.get('thirdAssetType') 

    try:
        if is_minted(token_id):
            with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'flask', 'db.json'), 'r') as file:
                data = json.load(file)
                image = compose_ape(token_id, data, base_dir, asset_type, second_asset_type, third_asset_type)

            if image:
                img_io = BytesIO()
                image.save(img_io, 'PNG')
                img_io.seek(0)
                return send_file(img_io, mimetype='image/png')
            else:
                raise ValueError("Ape not found")

        default_image_url = url_for('static', filename='/face.png')
        return jsonify({'image_url': default_image_url, 'message': 'This ape has not changed their perspective yet'})
    
    except Exception as e:
        print(f"Error processing Token ID {token_id}: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/get-background-color', methods=['GET'])
def get_background_color():
    token_id = request.args.get('tokenId')
    try:
        with open('../flask/db.json', 'r') as file:
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
        with open('../flask/afa_db.json', 'r') as file:
            minted_apes = json.load(file)
            # Extract TOKENID values
            token_ids = [ape['TOKENID'] for ape in minted_apes]
        return jsonify(token_ids)
    except Exception as e:
        app.logger.error(f"Error in get_token_ids: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

