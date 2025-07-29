# 🎨 TrendSiam AI Image Generation System

Complete AI-powered editorial illustration system for trending Thai news using OpenAI DALL-E 3.

## 🚀 Features

### ✅ **Automatic Image Generation**
- **Smart Selection**: Automatically selects top 3 news items by popularity score
- **Editorial Style**: Generates newspaper-appropriate illustrations
- **Category-Aware**: Tailors images based on news content (sports, entertainment, etc.)
- **Cultural Sensitivity**: Respectful representation of Thai content

### ✅ **Production-Ready Implementation**
- **Error Handling**: Comprehensive error handling for API failures
- **Rate Limiting**: Built-in delays to respect OpenAI API limits
- **Duplicate Prevention**: Skips items that already have AI images
- **Modular Design**: Clean, maintainable code structure

### ✅ **Streamlit Integration**
- **Visual Display**: Automatic image display in news cards
- **Admin Panel**: Built-in UI for generating images
- **Toggle Controls**: Optional display of images and prompts
- **Mobile Responsive**: Works on all device sizes

## 📋 Prerequisites

### **1. OpenAI API Key**
You need a valid OpenAI API key with access to DALL-E 3:
```bash
# Set as environment variable (recommended)
export OPENAI_API_KEY="your-openai-api-key-here"
```

### **2. Dependencies**
Install required packages:
```bash
pip install -r requirements.txt
```

### **3. Data File**
Ensure `thailand_trending_summary.json` exists with news data including popularity scores.

## 🔧 Usage Methods

### **Method 1: Command Line**
```bash
# Using environment variable
python ai_image_generator.py

# Or pass API key directly
python ai_image_generator.py your-api-key-here

# Or use the example script
python generate_ai_images_example.py
```

### **Method 2: Python Script**
```python
from ai_image_generator import generate_ai_images_for_top3_news

# Generate images
result = generate_ai_images_for_top3_news("your-api-key")

if result['success']:
    print(f"Generated {result['successful']} images!")
else:
    print(f"Error: {result['message']}")
```

### **Method 3: Streamlit Admin Panel**
1. Launch the app: `streamlit run app.py`
2. Click "🔧 Toggle Admin Controls"
3. Enter your OpenAI API key
4. Click "🎨 Generate AI Images"
5. Wait for generation to complete
6. Enable "🖼️ Show AI Images & Prompts" to see results

## 🎯 How It Works

### **1. News Selection**
```python
# Selects top 3 news items by popularity_score
top3_news = sorted(news_data, key=lambda x: x.get('popularity_score', 0), reverse=True)[:3]
```

### **2. Prompt Generation**
```python
# Category-specific prompts based on content analysis
if "volleyball" in title + summary:
    prompt = "Symbolic volleyball court with Thai flag elements..."
elif "blackpink" in title + summary:
    prompt = "Abstract music-themed illustration with stylized notes..."
```

### **3. Image Generation**
```python
# DALL-E 3 API call with editorial styling
response = client.images.generate(
    model="dall-e-3",
    prompt=prompt,
    size="1024x1024",
    quality="standard",
    n=1
)
```

### **4. Data Storage**
```python
# Saves image URL and prompt to news data
news_item['ai_image_url'] = image_url
news_item['ai_image_prompt'] = prompt
```

## 📁 File Structure

```
TrendSiam/
├── ai_image_generator.py          # Main AI image generation module
├── generate_ai_images_example.py  # Example usage script
├── app.py                         # Updated Streamlit app with image display
├── thailand_trending_summary.json # News data (with AI image URLs added)
├── requirements.txt               # Updated dependencies
└── AI_IMAGE_GENERATION_README.md  # This file
```

## 🖼️ Generated Image Examples

Based on your actual news data:

### **Volleyball Match (Top News)**
- **Title**: "🔴 LIVE: 🇹🇭 ไทย พบ 🇨🇦 แคนาดา | VNL 2025"
- **Generated Prompt**: "Symbolic volleyball court with Thai flag elements, players silhouettes in action, sports arena atmosphere..."
- **Image Style**: Dynamic sports illustration with Thai cultural elements

### **BLACKPINK Music Video**
- **Title**: "BLACKPINK - '뛰어(JUMP)' M/V"
- **Generated Prompt**: "Abstract music-themed illustration with stylized musical notes, sound waves, and stage lighting effects..."
- **Image Style**: Vibrant music-themed editorial illustration

### **Gaming Content**
- **Title**: "Minecraft gameplay video"
- **Generated Prompt**: "Abstract gaming-themed illustration with geometric pixel art elements..."
- **Image Style**: Clean gaming-inspired editorial design

## 📊 Cost Estimation

### **OpenAI DALL-E 3 Pricing**
- **Standard Quality**: ~$0.040 per image (1024×1024)
- **Top 3 News**: ~$0.12 per generation cycle
- **Monthly Cost**: ~$3.60 (assuming daily generation)

### **Rate Limits**
- **Free Tier**: 5 images per minute
- **Paid Tier**: 7 images per minute
- **Built-in Delays**: 2 seconds between generations

## 🛠️ Configuration Options

### **Image Sizes Available**
```python
# Supported DALL-E 3 sizes
sizes = ["1024x1024", "1792x1024", "1024x1792", "1536x1024", "1024x1536"]
```

### **Quality Settings**
```python
# Quality options
quality = "standard"  # or "hd" (costs more)
```

### **Model Selection**
```python
# Currently using DALL-E 3
model = "dall-e-3"  # Most advanced model
```

## 🔍 Troubleshooting

### **Common Issues**

#### ❌ "OpenAI API key not found"
**Solution**: Set your API key properly:
```bash
export OPENAI_API_KEY="your-key-here"
```

#### ❌ "Rate limit exceeded"
**Solution**: Wait a few minutes and try again. The system has built-in delays.

#### ❌ "No news data found"
**Solution**: Ensure `thailand_trending_summary.json` exists and contains valid data.

#### ❌ "Failed to generate image"
**Solution**: 
- Check your OpenAI API credits
- Verify internet connection
- Ensure prompt is appropriate (no restricted content)

### **Debug Mode**
Enable detailed logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 🚀 Advanced Usage

### **Custom Prompts**
```python
# Override default prompt generation
custom_prompt = "Your custom editorial illustration prompt..."
image_url = generator.generate_image_with_dalle(custom_prompt)
```

### **Batch Processing**
```python
# Generate images for all news items (not just top 3)
generator = TrendSiamImageGenerator(api_key)
for news_item in news_data:
    if not news_item.get('ai_image_url'):
        # Generate image for this item
        prompt = generator.generate_editorial_illustration_prompt(news_item)
        image_url = generator.generate_image_with_dalle(prompt)
        if image_url:
            news_item['ai_image_url'] = image_url
```

### **Custom Categories**
Add new categories to the prompt generation system by editing the `generate_editorial_illustration_prompt` method.

## 📈 Performance Optimization

### **Tips for Production**
1. **Caching**: Consider caching generated images locally
2. **Background Processing**: Run image generation as a background task
3. **Webhooks**: Use OpenAI webhooks for async processing
4. **CDN**: Store images on a CDN for faster loading

### **Cost Optimization**
1. **Skip Duplicates**: System automatically skips existing images
2. **Smart Selection**: Only generates for top news items
3. **Batch Processing**: Group generations to minimize API calls

## 🔒 Security Best Practices

1. **API Key Security**: Never commit API keys to version control
2. **Environment Variables**: Use environment variables for sensitive data
3. **Rate Limiting**: Respect OpenAI's rate limits
4. **Content Moderation**: Monitor generated content for appropriateness

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review OpenAI DALL-E 3 documentation
3. Ensure all dependencies are installed correctly
4. Verify your API key has sufficient credits

---

## ✅ System Status

**Current Implementation Status:**
- ✅ AI Image Generation Module (`ai_image_generator.py`)
- ✅ Streamlit UI Integration (`app.py`)
- ✅ Admin Panel with API Key Input
- ✅ Automatic Image Display in News Cards
- ✅ Error Handling and Rate Limiting
- ✅ Example Scripts and Documentation
- ✅ Production-Ready Code Structure

**Ready for Production Use!** 🚀 