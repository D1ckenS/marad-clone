// react-router-dom v6 + TypeScript 5.9 + @types/react 18.x compatibility fix.
// Routes/Route return React.ReactElement which TypeScript 5.9's stricter JSX
// validation cannot assign to ReactNode through the ReactPortal union member.
// Overriding to JSX.Element | null (ReactElement<any,any>) satisfies the check.
import 'react-router-dom';

declare module 'react-router-dom' {
  export function Routes(
    props: import('react-router-dom').RoutesProps,
  ): import('react').JSX.Element | null;
  export function Route(
    props: import('react-router-dom').RouteProps,
  ): import('react').JSX.Element | null;
  export function Navigate(
    props: import('react-router-dom').NavigateProps,
  ): import('react').JSX.Element | null;
}
