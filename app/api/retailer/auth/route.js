import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { signToken, setAuthCookie } from '@/lib/auth';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return new Response(
        getErrorHTML('Link Missing', 'This private ordering link is invalid or missing its authentication token.'),
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Look up active retailer in database
    const retailer = await prisma.retailer.findUnique({
      where: { 
        token: token,
        active: true
      }
    });

    if (!retailer) {
      return new Response(
        getErrorHTML('Link Invalid or Expired', 'This private ordering link has been deactivated or regenerated. Please message your VPD salesman or administrator to receive your new active link.'),
        { status: 403, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Create JWT session token containing retailer details
    const jwtToken = signToken({
      role: 'retailer',
      id: retailer.id,
      shopName: retailer.shopName,
      phone: retailer.phone
    });

    // Redirect to browse view
    const redirectUrl = new URL('/browse', request.url);
    const response = NextResponse.redirect(redirectUrl);
    setAuthCookie(response, 'retailer_session', jwtToken);
    
    return response;
  } catch (error) {
    console.error('Retailer authentication error:', error);
    return new Response(
      getErrorHTML('Internal Server Error', 'An error occurred while authenticating. Please try again later.'),
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

function getErrorHTML(title, message) {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      :root {
        --bg-primary: #f8fafc;
        --bg-card: #ffffff;
        --text-main: #0f172a;
        --text-muted: #64748b;
        --border-color: #e2e8f0;
        --danger: #ef4444;
        --danger-light: #fef2f2;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg-primary: #0f172a;
          --bg-card: #1e293b;
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --border-color: #334155;
        }
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background-color: var(--bg-primary);
        color: var(--text-main);
        margin: 0;
        padding: 24px;
        box-sizing: border-box;
      }
      .card {
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        padding: 32px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08);
        max-width: 400px;
        width: 100%;
        text-align: center;
      }
      h1 {
        font-size: 22px;
        font-weight: 800;
        margin: 12px 0 8px 0;
      }
      p {
        color: var(--text-muted);
        font-size: 15px;
        line-height: 1.6;
        margin: 0;
      }
      .icon {
        font-size: 48px;
        color: var(--danger);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">⚠️</div>
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`;
}
