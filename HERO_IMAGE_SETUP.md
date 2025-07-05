# Hero Background Image Setup

## How to Add Your Photo to the Homepage Hero Section

### Step 1: Prepare Your Image
1. Choose a high-quality image (recommended: 1920x1080 or larger)
2. Good options include:
   - Badminton court photos
   - Sports facility images
   - Abstract sports-related images
   - Professional badminton players in action

### Step 2: Add Your Image
1. Place your image file in the `public/images/` directory
2. Name it `hero-bg.jpg` (or update the CSS to match your filename)
3. Supported formats: JPG, PNG, WebP

### Step 3: Update the CSS (if needed)
If your image has a different filename, update this line in `views/index.ejs`:
```css
background-image: url('/images/your-image-name.jpg');
```

### Step 4: Adjust Image Settings
You can modify these properties in the CSS:

**Opacity (how transparent the image is):**
```css
opacity: 0.3; /* 0.1 = very transparent, 0.9 = very visible */
```

**Image filters (optional):**
```css
filter: brightness(0.8) contrast(1.1);
```

**Background position:**
```css
background-position: center; /* or: top, bottom, left, right */
```

### Step 5: Test Your Changes
1. Refresh your homepage at `http://localhost:3000/`
2. The image should appear behind the blue gradient
3. Adjust opacity if text is hard to read

### Tips for Best Results:
- Use images with good contrast
- Avoid images with too much text or busy patterns
- Test on mobile devices
- The image will be automatically responsive

### Example Image Sources:
- Unsplash: https://unsplash.com/s/photos/badminton
- Pexels: https://www.pexels.com/search/badminton/
- Your own photos of local courts

The image will be layered behind the existing gradient and pattern effects, creating a beautiful glassmorphism effect! 