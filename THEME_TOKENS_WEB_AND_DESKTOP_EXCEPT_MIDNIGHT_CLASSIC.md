# Genesis Theme Token Inventory

Scope: all theme variants except Midnight Classic. This file combines the web theme source in `apps/genesis-app/config/themes.ts` and the desktop theme source in `apps/genesis-desktop/src/lib/data/themes.ts`.

## Web theme source tokens

### Genesis Classic (`genesis`)
```yaml
colors:
  primary: ["#FF9B71", "#FFD93D"]
  accent: ["#FFD93D", "#FF9B71"]
  background: "#FFF8E7"
  text: "#5A5A5A"
  textLight: "#8B7E74"
  border: "#FFE4CC"
  shadow: "255, 155, 113, 0.15"
cssVariables:
  --color-primary-start: "#FF9B71"
  --color-primary-end: "#FFD93D"
  --color-accent-start: "#FFD93D"
  --color-accent-end: "#FF9B71"
  --color-background: "#FFF8E7"
  --color-surface: "#FFFFFF"
  --color-text: "#5A5A5A"
  --color-text-light: "#8B7E74"
  --color-border: "#FFE4CC"
  --color-shadow: "255, 155, 113"
darkColors:
  primary: ["#E87D56", "#E5C02B"]
  accent: ["#E5C02B", "#E87D56"]
  background: "#1A1412"
  surface: "#2A201D"
  text: "#EAE0D5"
  textLight: "#A89F91"
  border: "#3D302B"
  shadow: "255, 155, 113"
darkCssVariables:
  --color-primary-start: "#E87D56"
  --color-primary-end: "#E5C02B"
  --color-accent-start: "#E5C02B"
  --color-accent-end: "#E87D56"
  --color-background: "#1A1412"
  --color-surface: "#2A201D"
  --color-text: "#EAE0D5"
  --color-text-light: "#A89F91"
  --color-border: "#3D302B"
  --color-shadow: "255, 155, 113"
```

### Aurora Scholar (`aurora`)
```yaml
colors:
  primary: ["#4A148C", "#E91E63"]
  accent: ["#FFB74D", "#9C27B0"]
  background: "#F8F5FF"
  text: "#2D1B4E"
  textLight: "#6A4F8B"
  border: "#E1BEE7"
  shadow: "74, 20, 140, 0.1"
cssVariables:
  --color-primary-start: "#4A148C"
  --color-primary-end: "#E91E63"
  --color-accent-start: "#FFB74D"
  --color-accent-end: "#9C27B0"
  --color-background: "#F8F5FF"
  --color-surface: "#FFFFFF"
  --color-text: "#2D1B4E"
  --color-text-light: "#6A4F8B"
  --color-border: "#E1BEE7"
  --color-shadow: "74, 20, 140"
darkColors:
  primary: ["#7C4DFF", "#F48FB1"]
  accent: ["#FFCC80", "#CE93D8"]
  background: "#130C1C"
  surface: "#1E152D"
  text: "#E2D8F0"
  textLight: "#A594BD"
  border: "#362554"
  shadow: "74, 20, 140"
darkCssVariables:
  --color-primary-start: "#7C4DFF"
  --color-primary-end: "#F48FB1"
  --color-accent-start: "#FFCC80"
  --color-accent-end: "#CE93D8"
  --color-background: "#130C1C"
  --color-surface: "#1E152D"
  --color-text: "#E2D8F0"
  --color-text-light: "#A594BD"
  --color-border: "#362554"
  --color-shadow: "74, 20, 140"
```

### Ocean Academy (`ocean`)
```yaml
colors:
  primary: ["#006064", "#00ACC1"]
  accent: ["#4DD0E1", "#80DEEA"]
  background: "#E0F7FA"
  text: "#00363A"
  textLight: "#00838F"
  border: "#B2EBF2"
  shadow: "0, 96, 100, 0.1"
cssVariables:
  --color-primary-start: "#006064"
  --color-primary-end: "#00ACC1"
  --color-accent-start: "#4DD0E1"
  --color-accent-end: "#80DEEA"
  --color-background: "#E0F7FA"
  --color-surface: "#FFFFFF"
  --color-text: "#00363A"
  --color-text-light: "#00838F"
  --color-border: "#B2EBF2"
  --color-shadow: "0, 96, 100"
darkColors:
  primary: ["#26C6DA", "#80DEEA"]
  accent: ["#B2EBF2", "#E0F7FA"]
  background: "#0A191C"
  surface: "#12272B"
  text: "#D5EFEF"
  textLight: "#85AFA8"
  border: "#1A424A"
  shadow: "0, 96, 100"
darkCssVariables:
  --color-primary-start: "#26C6DA"
  --color-primary-end: "#80DEEA"
  --color-accent-start: "#B2EBF2"
  --color-accent-end: "#E0F7FA"
  --color-background: "#0A191C"
  --color-surface: "#12272B"
  --color-text: "#D5EFEF"
  --color-text-light: "#85AFA8"
  --color-border: "#1A424A"
  --color-shadow: "0, 96, 100"
```

### Forest Wisdom (`forest`)
```yaml
colors:
  primary: ["#2E7D32", "#66BB6A"]
  accent: ["#AED581", "#FFE57F"]
  background: "#F1F8E9"
  text: "#1B5E20"
  textLight: "#558B2F"
  border: "#C5E1A5"
  shadow: "46, 125, 50, 0.1"
cssVariables:
  --color-primary-start: "#2E7D32"
  --color-primary-end: "#66BB6A"
  --color-accent-start: "#AED581"
  --color-accent-end: "#FFE57F"
  --color-background: "#F1F8E9"
  --color-surface: "#FFFFFF"
  --color-text: "#1B5E20"
  --color-text-light: "#558B2F"
  --color-border: "#C5E1A5"
  --color-shadow: "46, 125, 50"
darkColors:
  primary: ["#66BB6A", "#A5D6A7"]
  accent: ["#C5E1A5", "#FFF59D"]
  background: "#0F1A12"
  surface: "#18291B"
  text: "#DBEFE0"
  textLight: "#8EAB94"
  border: "#28462C"
  shadow: "46, 125, 50"
darkCssVariables:
  --color-primary-start: "#66BB6A"
  --color-primary-end: "#A5D6A7"
  --color-accent-start: "#C5E1A5"
  --color-accent-end: "#FFF59D"
  --color-background: "#0F1A12"
  --color-surface: "#18291B"
  --color-text: "#DBEFE0"
  --color-text-light: "#8EAB94"
  --color-border: "#28462C"
  --color-shadow: "46, 125, 50"
```

### Nebula Mind (`nebula`)
```yaml
colors:
  primary: ["#1A237E", "#7B1FA2"]
  accent: ["#E91E63", "#FFD54F"]
  background: "#EDE7F6"
  text: "#12005E"
  textLight: "#5E35B1"
  border: "#D1C4E9"
  shadow: "26, 35, 126, 0.1"
cssVariables:
  --color-primary-start: "#1A237E"
  --color-primary-end: "#7B1FA2"
  --color-accent-start: "#E91E63"
  --color-accent-end: "#FFD54F"
  --color-background: "#EDE7F6"
  --color-surface: "#FFFFFF"
  --color-text: "#12005E"
  --color-text-light: "#5E35B1"
  --color-border: "#D1C4E9"
  --color-shadow: "26, 35, 126"
darkColors:
  primary: ["#5C6BC0", "#AB47BC"]
  accent: ["#EC407A", "#FFE082"]
  background: "#100C1A"
  surface: "#1A152A"
  text: "#DED8EB"
  textLight: "#938BA3"
  border: "#2A2244"
  shadow: "26, 35, 126"
darkCssVariables:
  --color-primary-start: "#5C6BC0"
  --color-primary-end: "#AB47BC"
  --color-accent-start: "#EC407A"
  --color-accent-end: "#FFE082"
  --color-background: "#100C1A"
  --color-surface: "#1A152A"
  --color-text: "#DED8EB"
  --color-text-light: "#938BA3"
  --color-border: "#2A2244"
  --color-shadow: "26, 35, 126"
```

### Sunset Scholar (`sunset`)
```yaml
colors:
  primary: ["#BF360C", "#FF6F00"]
  accent: ["#FFB74D", "#FFD54F"]
  background: "#FFF3E0"
  text: "#3E2723"
  textLight: "#8D6E63"
  border: "#FFCCBC"
  shadow: "191, 54, 12, 0.1"
cssVariables:
  --color-primary-start: "#BF360C"
  --color-primary-end: "#FF6F00"
  --color-accent-start: "#FFB74D"
  --color-accent-end: "#FFD54F"
  --color-background: "#FFF3E0"
  --color-surface: "#FFFFFF"
  --color-text: "#3E2723"
  --color-text-light: "#8D6E63"
  --color-border: "#FFCCBC"
  --color-shadow: "191, 54, 12"
darkColors:
  primary: ["#FF7043", "#FFCA28"]
  accent: ["#FFE082", "#FFF59D"]
  background: "#1C120C"
  surface: "#2D1C12"
  text: "#EFE5DE"
  textLight: "#AC9B8F"
  border: "#4A2E1F"
  shadow: "191, 54, 12"
darkCssVariables:
  --color-primary-start: "#FF7043"
  --color-primary-end: "#FFCA28"
  --color-accent-start: "#FFE082"
  --color-accent-end: "#FFF59D"
  --color-background: "#1C120C"
  --color-surface: "#2D1C12"
  --color-text: "#EFE5DE"
  --color-text-light: "#AC9B8F"
  --color-border: "#4A2E1F"
  --color-shadow: "191, 54, 12"
```

## Desktop theme source tokens

### Genesis Classic (`genesis`)
```yaml
light:
  --background: "#FFF8E7"
  --surface: "#FFFFFF"
  --card: "#FFFFFF"
  --popover: "#FFFFFF"
  --foreground: "#5A5A5A"
  --muted: "#8B7E74"
  --border: "#FFE4CC"
  --primary: "#FF9B71"
  --primary-hover: "#FFD93D"
  --accent: "#FFD93D"
  --color-primary-start: "#FF9B71"
  --color-primary-end: "#FFD93D"
  --color-accent-start: "#FFD93D"
  --color-accent-end: "#FF9B71"
  --color-text: "#5A5A5A"
  --color-text-light: "#8B7E74"
  --color-surface: "#FFFFFF"
  --color-background: "#FFF8E7"
  --color-border: "#FFE4CC"
  --color-shadow: "255 155 113"
dark:
  --background: "#1A1412"
  --surface: "#2A201D"
  --card: "#2A201D"
  --popover: "#2A201D"
  --foreground: "#EAE0D5"
  --muted: "#A89F91"
  --border: "#3D302B"
  --primary: "#E87D56"
  --primary-hover: "#E5C02B"
  --accent: "#E5C02B"
  --color-primary-start: "#E87D56"
  --color-primary-end: "#E5C02B"
  --color-accent-start: "#E5C02B"
  --color-accent-end: "#E87D56"
  --color-text: "#EAE0D5"
  --color-text-light: "#A89F91"
  --color-surface: "#2A201D"
  --color-background: "#1A1412"
  --color-border: "#3D302B"
  --color-shadow: "255 155 113"
```

### Aurora Scholar (`aurora`)
```yaml
light:
  --background: "#F8F5FF"
  --surface: "#FFFFFF"
  --card: "#FFFFFF"
  --popover: "#FFFFFF"
  --foreground: "#2D1B4E"
  --muted: "#6A4F8B"
  --border: "#E1BEE7"
  --primary: "#4A148C"
  --primary-hover: "#E91E63"
  --accent: "#FFB74D"
  --color-primary-start: "#4A148C"
  --color-primary-end: "#E91E63"
  --color-accent-start: "#FFB74D"
  --color-accent-end: "#9C27B0"
  --color-text: "#2D1B4E"
  --color-text-light: "#6A4F8B"
  --color-surface: "#FFFFFF"
  --color-background: "#F8F5FF"
  --color-border: "#E1BEE7"
  --color-shadow: "74 20 140"
dark:
  --background: "#130C1C"
  --surface: "#1E152D"
  --card: "#1E152D"
  --popover: "#1E152D"
  --foreground: "#E2D8F0"
  --muted: "#A594BD"
  --border: "#362554"
  --primary: "#7C4DFF"
  --primary-hover: "#F48FB1"
  --accent: "#FFCC80"
  --color-primary-start: "#7C4DFF"
  --color-primary-end: "#F48FB1"
  --color-accent-start: "#FFCC80"
  --color-accent-end: "#CE93D8"
  --color-text: "#E2D8F0"
  --color-text-light: "#A594BD"
  --color-surface: "#1E152D"
  --color-background: "#130C1C"
  --color-border: "#362554"
  --color-shadow: "74 20 140"
```

### Ocean Academy (`ocean`)
```yaml
light:
  --background: "#E0F7FA"
  --surface: "#FFFFFF"
  --card: "#FFFFFF"
  --popover: "#FFFFFF"
  --foreground: "#00363A"
  --muted: "#00838F"
  --border: "#B2EBF2"
  --primary: "#006064"
  --primary-hover: "#00ACC1"
  --accent: "#4DD0E1"
  --color-primary-start: "#006064"
  --color-primary-end: "#00ACC1"
  --color-accent-start: "#4DD0E1"
  --color-accent-end: "#80DEEA"
  --color-text: "#00363A"
  --color-text-light: "#00838F"
  --color-surface: "#FFFFFF"
  --color-background: "#E0F7FA"
  --color-border: "#B2EBF2"
  --color-shadow: "0 96 100"
dark:
  --background: "#0A191C"
  --surface: "#12272B"
  --card: "#12272B"
  --popover: "#12272B"
  --foreground: "#D5EFEF"
  --muted: "#85AFA8"
  --border: "#1A424A"
  --primary: "#26C6DA"
  --primary-hover: "#80DEEA"
  --accent: "#B2EBF2"
  --color-primary-start: "#26C6DA"
  --color-primary-end: "#80DEEA"
  --color-accent-start: "#B2EBF2"
  --color-accent-end: "#E0F7FA"
  --color-text: "#D5EFEF"
  --color-text-light: "#85AFA8"
  --color-surface: "#12272B"
  --color-background: "#0A191C"
  --color-border: "#1A424A"
  --color-shadow: "0 96 100"
```

### Forest Wisdom (`forest`)
```yaml
light:
  --background: "#F1F8E9"
  --surface: "#FFFFFF"
  --card: "#FFFFFF"
  --popover: "#FFFFFF"
  --foreground: "#1B5E20"
  --muted: "#558B2F"
  --border: "#C5E1A5"
  --primary: "#2E7D32"
  --primary-hover: "#66BB6A"
  --accent: "#AED581"
  --color-primary-start: "#2E7D32"
  --color-primary-end: "#66BB6A"
  --color-accent-start: "#AED581"
  --color-accent-end: "#FFE57F"
  --color-text: "#1B5E20"
  --color-text-light: "#558B2F"
  --color-surface: "#FFFFFF"
  --color-background: "#F1F8E9"
  --color-border: "#C5E1A5"
  --color-shadow: "46 125 50"
dark:
  --background: "#0F1A12"
  --surface: "#18291B"
  --card: "#18291B"
  --popover: "#18291B"
  --foreground: "#DBEFE0"
  --muted: "#8EAB94"
  --border: "#28462C"
  --primary: "#66BB6A"
  --primary-hover: "#A5D6A7"
  --accent: "#C5E1A5"
  --color-primary-start: "#66BB6A"
  --color-primary-end: "#A5D6A7"
  --color-accent-start: "#C5E1A5"
  --color-accent-end: "#FFF59D"
  --color-text: "#DBEFE0"
  --color-text-light: "#8EAB94"
  --color-surface: "#18291B"
  --color-background: "#0F1A12"
  --color-border: "#28462C"
  --color-shadow: "46 125 50"
```

### Nebula Mind (`nebula`)
```yaml
light:
  --background: "#EDE7F6"
  --surface: "#FFFFFF"
  --card: "#FFFFFF"
  --popover: "#FFFFFF"
  --foreground: "#12005E"
  --muted: "#5E35B1"
  --border: "#D1C4E9"
  --primary: "#1A237E"
  --primary-hover: "#7B1FA2"
  --accent: "#E91E63"
  --color-primary-start: "#1A237E"
  --color-primary-end: "#7B1FA2"
  --color-accent-start: "#E91E63"
  --color-accent-end: "#FFD54F"
  --color-text: "#12005E"
  --color-text-light: "#5E35B1"
  --color-surface: "#FFFFFF"
  --color-background: "#EDE7F6"
  --color-border: "#D1C4E9"
  --color-shadow: "26 35 126"
dark:
  --background: "#100C1A"
  --surface: "#1A152A"
  --card: "#1A152A"
  --popover: "#1A152A"
  --foreground: "#DED8EB"
  --muted: "#938BA3"
  --border: "#2A2244"
  --primary: "#5C6BC0"
  --primary-hover: "#AB47BC"
  --accent: "#EC407A"
  --color-primary-start: "#5C6BC0"
  --color-primary-end: "#AB47BC"
  --color-accent-start: "#EC407A"
  --color-accent-end: "#FFE082"
  --color-text: "#DED8EB"
  --color-text-light: "#938BA3"
  --color-surface: "#1A152A"
  --color-background: "#100C1A"
  --color-border: "#2A2244"
  --color-shadow: "26 35 126"
```

### Sunset Scholar (`sunset`)
```yaml
light:
  --background: "#FFF3E0"
  --surface: "#FFFFFF"
  --card: "#FFFFFF"
  --popover: "#FFFFFF"
  --foreground: "#3E2723"
  --muted: "#8D6E63"
  --border: "#FFCCBC"
  --primary: "#BF360C"
  --primary-hover: "#FF6F00"
  --accent: "#FFB74D"
  --color-primary-start: "#BF360C"
  --color-primary-end: "#FF6F00"
  --color-accent-start: "#FFB74D"
  --color-accent-end: "#FFD54F"
  --color-text: "#3E2723"
  --color-text-light: "#8D6E63"
  --color-surface: "#FFFFFF"
  --color-background: "#FFF3E0"
  --color-border: "#FFCCBC"
  --color-shadow: "191 54 12"
dark:
  --background: "#1C120C"
  --surface: "#2D1C12"
  --card: "#2D1C12"
  --popover: "#2D1C12"
  --foreground: "#EFE5DE"
  --muted: "#AC9B8F"
  --border: "#4A2E1F"
  --primary: "#FF7043"
  --primary-hover: "#FFCA28"
  --accent: "#FFE082"
  --color-primary-start: "#FF7043"
  --color-primary-end: "#FFCA28"
  --color-accent-start: "#FFE082"
  --color-accent-end: "#FFF59D"
  --color-text: "#EFE5DE"
  --color-text-light: "#AC9B8F"
  --color-surface: "#2D1C12"
  --color-background: "#1C120C"
  --color-border: "#4A2E1F"
  --color-shadow: "191 54 12"
```
