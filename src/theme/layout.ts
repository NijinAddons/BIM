import type {ViewStyle} from 'react-native';

/** A fixed-size box with its content centred — icon tiles, avatars, etc. */
export const iconBox = (
  size: number,
  borderRadius: number,
  backgroundColor?: string,
): ViewStyle => ({
  alignItems: 'center',
  backgroundColor,
  borderRadius,
  height: size,
  justifyContent: 'center',
  width: size,
});
