import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ImageFontDelivery } from './ImageFontDelivery';
for (const optimized of [false, true]) {
  it(`${optimized ? 'optimized' : 'baseline'} controls dimensions, priority, formats and font policy`, () => {
    const { container } = render(<ImageFontDelivery optimized={optimized} />);
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(3);
    images.forEach((image, index) => {
      expect(image).toHaveAttribute(
        'loading',
        optimized && index > 0 ? 'lazy' : 'eager',
      );
      expect(image).toHaveAttribute(
        'fetchpriority',
        optimized ? (index === 0 ? 'high' : 'low') : 'auto',
      );
      if (optimized) {
        expect(image).toHaveAttribute('width', '1280');
        expect(image).toHaveAttribute('height', '720');
        expect(image).toHaveAttribute('decoding', 'async');
      } else {
        expect(image).not.toHaveAttribute('width');
        expect(image).not.toHaveAttribute('height');
        expect(image.getAttribute('src')).toMatch(/2400.jpg$/);
      }
    });
    expect(container.querySelectorAll('picture')).toHaveLength(
      optimized ? 3 : 0,
    );
    if (optimized) {
      for (const source of container.querySelectorAll('source')) {
        expect(source.getAttribute('srcset')).toMatch(/480w.*960w.*1280w/);
        expect(source).toHaveAttribute('sizes');
      }
    }
    for (const frame of screen.getAllByTestId('delivery-frame'))
      expect(frame).toHaveAttribute('data-reserved', String(optimized));
    expect(screen.getByTestId('image-font-delivery')).toHaveAttribute(
      'data-font-strategy',
      optimized ? 'optional' : 'swap',
    );
    expect(document.querySelector('link[as="font"]') !== null).toBe(optimized);
  });
}
