import { useColorScheme } from 'react-native';
import colors from '../constants/colors';

export function useColors() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return {
    ...(isDark ? colors.dark : colors.light),
    radius: colors.radius,
  };
}
