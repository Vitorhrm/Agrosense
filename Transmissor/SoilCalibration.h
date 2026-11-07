#pragma once
#include <math.h>

// Normalizacao de dois pontos: indice relativo ao solo de referencia, nao teor de agua.
class SoilCalibration {
 public:
  // Aceita qualquer polaridade, mas exige referencias diferentes e dentro do ADC de 12 bits.
  static constexpr bool valid(int dry, int wet) {
    return dry >= 0 && dry <= 4095 && wet >= 0 && wet <= 4095 && dry != wet;
  }

  // Retorna NAN sem calibracao; limita o indice a 0..100 sem alterar o ADC original.
  static constexpr float relativeIndex(int raw, int dry, int wet) {
    if (!valid(dry, wet) || raw < 0 || raw > 4095) return NAN;
    const float index = 100.0f * (raw - dry) / (wet - dry); // Seco=0; referencia molhada=100.
    return index < 0 ? 0 : (index > 100 ? 100 : index);
  }
};
