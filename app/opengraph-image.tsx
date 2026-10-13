import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo/metadata';

export const alt = 'Folkets Meninger — din stemme mellom valgene';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#00205b',
          padding: '80px',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: '#ba0c2f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            FM
          </div>
          <div style={{ fontSize: 32, fontWeight: 600 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>Din stemme teller.</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, color: '#f3b6c4' }}>
            Også mellom valgene.
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#c9d6f0' }}>folkets-meninger.no</div>
      </div>
    ),
    { ...size },
  );
}
