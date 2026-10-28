import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer).not.toBeNull();
  if (renderer) {
    expect((renderer as ReactTestRenderer.ReactTestRenderer).toJSON()).toBeDefined();
    await act(async () => {
      (renderer as ReactTestRenderer.ReactTestRenderer).unmount();
    });
  }
});
