// Generated placeholder (no real photos): a simple bed drawing tinted with the chosen colour.
// `view` zooms into a different part, so the 5 gallery images look different.
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

const VIEWBOXES = ['0 0 400 300', '-40 20 400 300', '60 0 200 150', '40 120 240 180', '120 60 160 120'];
const CAPTIONS = ['Front view', 'Side view', 'Headboard', 'Drawers', 'Detail'];

export function Placeholder({ hex, view = 0, width, height }: { hex: string; view?: number; width: number; height: number }) {
  const i = view % VIEWBOXES.length;
  return (
    <Svg width={width} height={height} viewBox={VIEWBOXES[i]} preserveAspectRatio="xMidYMid slice">
      <Rect x={-100} y={-100} width={700} height={600} fill="#ece9e4" />
      <Rect x={-100} y={235} width={700} height={200} fill="#d9d3ca" />
      <Rect x={70} y={60} width={260} height={110} rx={8} fill={hex} />
      <Rect x={70} y={60} width={260} height={110} rx={8} fill="#000" opacity={0.12} />
      <Rect x={55} y={150} width={290} height={45} rx={10} fill="#fdfcfb" stroke="#cfc9c0" />
      <Rect x={55} y={190} width={290} height={55} rx={6} fill={hex} />
      <Rect x={70} y={203} width={120} height={30} rx={3} fill="#000" opacity={0.14} />
      <Rect x={210} y={203} width={120} height={30} rx={3} fill="#000" opacity={0.14} />
      <Rect x={70} y={245} width={14} height={12} fill="#6b5b4b" />
      <Rect x={316} y={245} width={14} height={12} fill="#6b5b4b" />
      <SvgText x={200} y={285} textAnchor="middle" fontSize={12} fill="#6b645b">
        {`Prague Divan Bed · ${CAPTIONS[i]}`}
      </SvgText>
    </Svg>
  );
}
