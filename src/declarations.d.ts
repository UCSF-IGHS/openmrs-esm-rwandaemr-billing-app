declare module '*.css';
declare module '*.scss';
declare module '*.png';
declare module '*.svg' {
  const content: string;
  export default content;
}

declare type SideNavProps = object;
