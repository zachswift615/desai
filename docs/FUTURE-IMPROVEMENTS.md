# Desai Future Improvements

## Current State (2024-12-14)

The device frame feature works but requires manual coordinate calculations. The AI has to:
1. Guess x/y positions
2. Export and visually inspect
3. Adjust and repeat

### Known Issues with Device Frame

1. **Screenshot corner radius too sharp** - The calculated ~68px corner radius clips the status bar icons
2. **Screen insets not precise** - Screenshot doesn't fit perfectly within bezel's screen area
3. **Manual positioning tedious** - Requires trial and error to get placement right

## Proposed Improvements

### 1. Device Profiles

Store exact measurements for each device bezel in a config file:

```json
{
  "iphone-16-pro-max": {
    "bezelPath": "ios-bezels/iPhone 16 Pro Max/iPhone 16 Pro Max.png",
    "bezelDimensions": { "width": 489, "height": 1000 },
    "screenArea": {
      "top": 18,
      "right": 16,
      "bottom": 18,
      "left": 16
    },
    "screenCornerRadius": 55,
    "displayName": "iPhone 16 Pro Max"
  },
  "iphone-16-pro": {
    // ... similar config
  }
}
```

Benefits:
- No more guessing insets or corner radii
- Easy to add new devices
- Consistent results every time

### 2. Intent-Based Device Placement

Current API (manual coordinates):
```javascript
{
  target: "device",
  op: "frame",
  screenshot: "/path/to/screenshot.png",
  bezel: "/path/to/bezel.png",
  x: 195,
  y: 550,
  w: 850
}
```

Proposed API (intent-based):
```javascript
{
  target: "device",
  op: "frame",
  screenshot: "/path/to/screenshot.png",
  device: "iphone-16-pro-max",  // Uses device profile
  size: 850,                      // Width in pixels
  position: "center"              // Auto-center on canvas
}
```

Or even simpler with presets:
```javascript
{
  target: "device",
  op: "frame",
  screenshot: "/path/to/screenshot.png",
  device: "iphone-16-pro-max",
  preset: "hero"  // Large, centered, good for App Store hero shots
}
```

### 3. Layout Operations

Add high-level layout helpers so the AI doesn't need to calculate positions:

```javascript
// Vertical stack with automatic spacing
{
  target: "layout",
  op: "stack",
  direction: "vertical",
  elements: ["headline-id", "device-id"],
  spacing: 100,
  align: "center"
}

// Center element on canvas
{
  target: "layout",
  op: "position",
  element: "device-id",
  horizontal: "center",
  vertical: "bottom",
  margin: 50
}

// Distribute elements evenly
{
  target: "layout",
  op: "distribute",
  elements: ["el1", "el2", "el3"],
  axis: "horizontal"
}
```

### 4. App Store Screenshot Templates

Pre-built templates for common App Store screenshot layouts:

```javascript
{
  target: "template",
  op: "app-store-hero",
  params: {
    headline: "Turn Any Document\nInto an Audiobook",
    screenshot: "/path/to/screenshot.png",
    device: "iphone-16-pro-max",
    background: "dark-gradient"
  }
}
```

This would automatically:
- Set canvas to correct App Store dimensions
- Apply the background
- Position and style the headline
- Add the device-framed screenshot in the right spot

### 5. Smart Positioning Keywords

Allow position keywords instead of pixel coordinates:

```javascript
// Instead of x: 645, y: 280
{
  target: "text",
  op: "create",
  position: { horizontal: "center", vertical: "top", marginTop: 150 },
  content: "Hello World",
  // ... other params
}
```

## Implementation Priority

1. **High Priority** - Fix device frame corner radius and insets for iPhone 16 Pro Max
2. **High Priority** - Add device profiles config file
3. **Medium Priority** - Add layout operations (stack, distribute, position)
4. **Medium Priority** - Intent-based device placement API
5. **Lower Priority** - App Store screenshot templates

## Notes

- The UI doesn't need to be perfect since this is primarily for AI agent use
- Focus on making the MCP API smart enough that the AI can describe intent rather than calculate pixels
- Device profiles should be easy to add/edit (JSON config file)
