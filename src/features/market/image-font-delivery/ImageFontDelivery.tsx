'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import styles from './ImageFontDelivery.module.css';
const scenes = [
  {
    id: 1,
    title: 'Market overview',
    alt: 'Geometric market skyline with a rising trend line',
  },
  {
    id: 2,
    title: 'Sector perspective',
    alt: 'Geometric sector skyline with a rising trend line',
  },
  {
    id: 3,
    title: 'Long-term perspective',
    alt: 'Geometric long-term skyline with a rising trend line',
  },
] as const;
const sizes = '(max-width: 768px) 100vw, (max-width: 1440px) 75vw, 1280px';
export function ImageFontDelivery({ optimized }: { optimized: boolean }) {
  const t = useTranslation();

  return (
    <section
      aria-label={t('Image and font delivery')}
      data-testid="image-font-delivery"
      className={`${styles.panel} ${optimized ? styles.optimized : styles.baseline}`}
      data-font-strategy={optimized ? 'optional' : 'swap'}
    >
      {optimized && (
        <link
          rel="preload"
          href="/delivery/geist-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      )}
      <h2>{t('Market perspectives')}</h2>
      <p>{t('Three views of the same deterministic market landscape.')}</p>
      {scenes.map((scene, index) => (
        <figure key={scene.id} className={styles.figure}>
          <div
            data-testid="delivery-frame"
            data-reserved={optimized}
            className={`${styles.frame} ${optimized ? styles.reserved : ''}`}
          >
            {optimized ? (
              <picture>
                <source
                  type="image/avif"
                  srcSet={[480, 960, 1280]
                    .map(
                      (width) =>
                        `/delivery/scene-${scene.id}-${width}.avif ${width}w`,
                    )
                    .join(', ')}
                  sizes={sizes}
                />
                <source
                  type="image/webp"
                  srcSet={[480, 960, 1280]
                    .map(
                      (width) =>
                        `/delivery/scene-${scene.id}-${width}.webp ${width}w`,
                    )
                    .join(', ')}
                  sizes={sizes}
                />
                {/* Native picture is intentional: the experiment controls format, dimensions and priority. */}
                <img
                  className={styles.image}
                  src={`/delivery/scene-${scene.id}-960.webp`}
                  alt={t.text(scene.alt)}
                  width={1280}
                  height={720}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  fetchPriority={index === 0 ? 'high' : 'low'}
                  decoding="async"
                />
              </picture>
            ) : (
              /* Missing dimensions and eager oversized JPEGs are intentional only in this scenario. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.image}
                src={`/delivery/scene-${scene.id}-2400.jpg`}
                alt={t.text(scene.alt)}
                loading="eager"
                fetchPriority="auto"
              />
            )}
          </div>
          <figcaption className={styles.caption}>
            {t.text(scene.title)}
          </figcaption>
        </figure>
      ))}
    </section>
  );
}
