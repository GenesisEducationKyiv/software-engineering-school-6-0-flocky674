import { test, expect } from '@playwright/test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';

let app: FastifyInstance;
let baseUrl: string;

test.beforeAll(async () => {
  app = buildApp();
  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
});

test.afterAll(async () => {
  await app.close();
});

test('renders the subscription form', async ({ page }) => {
  await page.goto(baseUrl);

  await expect(page.getByRole('heading', { name: 'Release Notifier' })).toBeVisible();
  await expect(page.getByLabel('Repository')).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Subscribe to releases' })).toBeVisible();
});

test('shows validation message when fields are empty', async ({ page }) => {
  await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Subscribe to releases' }).click();

  await expect(page.locator('#msg')).toHaveClass(/error/);
  await expect(page.locator('#msg')).toHaveText('Please fill in both fields.');
});

test('shows success message after subscribing', async ({ page }) => {
  await page.route('**/api/subscribe', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Confirmation email sent. Please check your inbox.',
      }),
    });
  });

  await page.goto(baseUrl);
  await page.getByLabel('Repository').fill('golang/go');
  await page.getByLabel('Email address').fill('user@example.com');
  await page.getByRole('button', { name: 'Subscribe to releases' }).click();

  await expect(page.locator('#msg')).toHaveClass(/success/);
  await expect(page.locator('#msg')).toContainText('Check your inbox at user@example.com');
  await expect(page.getByLabel('Repository')).toHaveValue('');
  await expect(page.getByLabel('Email address')).toHaveValue('');
});
