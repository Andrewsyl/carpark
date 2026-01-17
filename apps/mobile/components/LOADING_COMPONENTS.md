# Loading Components Guide

## 1. LoadingOverlay (Full-Screen)

Premium full-screen loading overlay for page transitions and major operations.

### Features
- Smooth fade in/out animations
- Branded Lottie animation
- Custom loading messages
- Prevents user interaction while loading
- Z-index 9999 (always on top)

### Usage

```tsx
import { LoadingOverlay } from "../components/LoadingOverlay";

function MyScreen() {
  const [loading, setLoading] = useState(false);

  return (
    <View>
      {/* Your content */}
      <LoadingOverlay visible={loading} message="Loading spaces..." />
    </View>
  );
}
```

### Props
- `visible: boolean` - Show/hide the overlay
- `message?: string` - Custom loading text (default: "Loading...")

### Best Used For
- Initial screen loads
- Page transitions
- Complex data fetching
- Payment processing
- Form submissions that take >1 second

---

## 2. Spinner (Inline Loading)

Versatile inline spinner for buttons, cards, and content areas.

### Features
- Three sizes: small, medium, large
- Custom colors
- Optional label text
- Optional centering

### Usage

```tsx
import { Spinner } from "../components/Spinner";

// Small spinner (no label)
<Spinner size="small" />

// Medium with label
<Spinner size="medium" label="Loading..." />

// Large centered
<Spinner size="large" center />

// Custom color
<Spinner color="#ff0000" label="Processing..." />
```

### Props
- `size?: "small" | "medium" | "large"` - Spinner size (default: "medium")
- `color?: string` - Color (default: colors.accent "#00d4aa")
- `label?: string` - Optional text below spinner
- `center?: boolean` - Center vertically and horizontally (default: false)

### Best Used For
- Button loading states
- Card placeholders
- Inline content loading
- List item loading
- Small operations (<1 second)

---

## Migration Examples

### Before
```tsx
<ActivityIndicator size="small" color="#00d4aa" />
```

### After
```tsx
<Spinner size="small" />
```

---

### Before
```tsx
{loading && (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator />
    <Text>Loading...</Text>
  </View>
)}
```

### After
```tsx
<LoadingOverlay visible={loading} message="Loading..." />
// OR
<Spinner size="large" label="Loading..." center />
```

---

## Quick Reference

| Component | Use Case | Animation | Blocks UI |
|-----------|----------|-----------|-----------|
| LoadingOverlay | Full page/transitions | Lottie | Yes |
| Spinner (center) | Content area | ActivityIndicator | No |
| Spinner (inline) | Buttons/cards | ActivityIndicator | No |

