# YouTube Data API v3 Setup Instructions

## Prerequisites

Make sure you have the required Python packages installed:

```bash
pip install python-dotenv requests
```

## Getting Your YouTube Data API v3 Key

1. **Go to Google Cloud Console**
   - Visit https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select a Project**
   - Create a new project or select an existing one
   - Note down your project name/ID

3. **Enable YouTube Data API v3**
   - Go to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3"
   - Click on it and press "Enable"

4. **Create API Key**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key
   - (Optional) Restrict the key to YouTube Data API v3 for security

5. **Set Up API Quotas**
   - The free tier includes 10,000 units per day
   - Each request costs 1-3 units (our script uses ~1 unit per request)

## Setting Up the .env File

Create a file named `.env` in the same directory as `youtube_api_fetcher.py`:

```bash
# .env file content
YOUTUBE_API_KEY=your_actual_api_key_here
```

**Example:**
```bash
YOUTUBE_API_KEY=AIzaSyBxyz123abcDEF456GHI789JKL_your_key_here
```

## Running the Script

Once your `.env` file is set up:

```bash
python youtube_api_fetcher.py
```

## Troubleshooting

### Common Issues:

1. **"YouTube API key not found"**
   - Check that `.env` file exists in the same directory
   - Verify the API key is set correctly in `.env`
   - Make sure there are no extra spaces around the API key

2. **"Access forbidden" (403 error)**
   - Verify your API key is correct
   - Check that YouTube Data API v3 is enabled for your project
   - Ensure you haven't exceeded your daily quota

3. **"Bad request" (400 error)**
   - This usually indicates an issue with the API parameters
   - Make sure your API key has permission to access YouTube Data API v3

4. **"Request timed out"**
   - Check your internet connection
   - Try running the script again

### API Quota Information:

- **Daily Limit**: 10,000 units (free tier)
- **Cost per request**: ~1 unit for our fetching request
- **Reset**: Quotas reset daily at midnight Pacific Time

### Security Note:

- Keep your API key secure and don't share it publicly
- Consider adding `.env` to your `.gitignore` file if using version control
- You can restrict your API key to specific APIs in Google Cloud Console for better security

## Expected Output

When successful, the script will:
1. Fetch 50 trending videos from Thailand
2. Display video title, channel, view count, and published date
3. Save complete data to `thailand_trending_api.json`

The output format will look like:
```
📺 #1 - Video Title Here
📺 Channel: Channel Name
👀 Views: 1,234,567
📅 Published: 2024-01-15 10:30:00 UTC
``` 