// styled-jsx ships with Next.js but does not augment React's element types,
// so `<style jsx>` / `<style jsx global>` report unknown-prop errors. This
// augmentation declares the `jsx` and `global` boolean attributes that
// styled-jsx adds to the intrinsic <style> element.
import 'react';

declare module 'react' {
  interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
