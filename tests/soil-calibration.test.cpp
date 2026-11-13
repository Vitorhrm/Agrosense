#include "../Station/SoilCalibration.h"

// Verifica a implementacao real em tempo de compilacao, sem depender de hardware conectado.
static_assert(!SoilCalibration::valid(-1, -1), "Referencias ausentes devem ser rejeitadas");
static_assert(!SoilCalibration::valid(2000, 2000), "Evitar divisao por zero");
static_assert(!SoilCalibration::valid(4096, 1000), "Referencias devem caber no ADC");
static_assert(SoilCalibration::relativeIndex(3000, 3000, 1000) == 0, "Extremo seco");
static_assert(SoilCalibration::relativeIndex(1000, 3000, 1000) == 100, "Extremo saturado");
static_assert(SoilCalibration::relativeIndex(2000, 3000, 1000) == 50, "Ponto medio");
static_assert(SoilCalibration::relativeIndex(4000, 3000, 1000) == 0, "Limite inferior");
static_assert(SoilCalibration::relativeIndex(500, 3000, 1000) == 100, "Limite superior");
static_assert(SoilCalibration::relativeIndex(2000, 1000, 3000) == 50, "Polaridade inversa");
