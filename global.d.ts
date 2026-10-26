declare module '*.png' {
  const value: number;
  export default value;
}

declare module '*.jpg' {
  const value: number;
  export default value;
}

declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import {ComponentType} from 'react';
  import {TextProps} from 'react-native';

  type IconProps = TextProps & {
    name: string;
    size?: number;
    color?: string;
  };

  const MaterialCommunityIcons: ComponentType<IconProps>;
  export default MaterialCommunityIcons;
}

// Provided by Hermes at runtime; not in React Native's bundled types.
declare function atob(data: string): string;
