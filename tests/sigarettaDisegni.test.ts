import { describe, expect, it } from 'vitest';
import { misureElettronica, misureNormale } from '../src/ui/sigarettaDisegni';

describe('misure del disegno', () => {
  it('sigaretta normale: la cartina si accorcia e la punta la segue', () => {
    expect(misureNormale(0).larghezzaCartina).toBeCloseTo(200);
    expect(misureNormale(0).spostamentoPunta).toBeCloseTo(0);
    expect(misureNormale(0.5).larghezzaCartina).toBeCloseTo(100);
    expect(misureNormale(0.5).spostamentoPunta).toBeCloseTo(-100);
    expect(misureNormale(1).larghezzaCartina).toBeCloseTo(0);
    expect(misureNormale(1).spostamentoPunta).toBeCloseTo(-200);
  });

  it('sigaretta elettronica: il liquido scende fino a svuotare il serbatoio', () => {
    expect(misureElettronica(0).altezzaLiquido).toBeCloseTo(20);
    expect(misureElettronica(0).yLiquido).toBeCloseTo(58);
    expect(misureElettronica(0.5).altezzaLiquido).toBeCloseTo(10);
    expect(misureElettronica(0.5).yLiquido).toBeCloseTo(68);
    expect(misureElettronica(1).altezzaLiquido).toBeCloseTo(0);
    expect(misureElettronica(1).yLiquido).toBeCloseTo(78);
  });

  it('fuori da 0–1 non produce misure negative né eccessive', () => {
    expect(misureNormale(-0.2).larghezzaCartina).toBeCloseTo(200);
    expect(misureNormale(1.5).larghezzaCartina).toBeCloseTo(0);
    expect(misureNormale(1.5).spostamentoPunta).toBeCloseTo(-200);
    expect(misureElettronica(-1).altezzaLiquido).toBeCloseTo(20);
    expect(misureElettronica(1.5).altezzaLiquido).toBeCloseTo(0);
  });
});
