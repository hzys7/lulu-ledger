// 基于 GiftedCharts 的折线图
import React, { useMemo } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { spacing } from '../../theme';

const screenWidth = Dimensions.get('window').width;
const CHART_WIDTH = screenWidth - spacing.base * 2 - spacing.base * 2;

export default function LineChartView({ data, accent, muted, divider, selectedDay, onSelectDay }) {
  if (!data || data.length === 0) return null;

  const chartData = useMemo(() => {
    return data.map(d => ({
      value: d.value,
      label: String(d.day),
    }));
  }, [data]);

  const selectedIndex = selectedDay != null
    ? data.findIndex(d => d.day === selectedDay)
    : -1;

  const maxValue = useMemo(() => {
    const max = Math.max(...data.map(d => d.value), 1);
    return Math.ceil(max * 1.1);
  }, [data]);

  return (
    <LineChart
        data={chartData}
        color={accent}
        thickness={2.5}
        width={CHART_WIDTH}
        height={160}
        maxValue={maxValue}
        noOfSections={4}
        isAnimated
        animationDuration={600}
        xAxisColor={divider}
        xAxisThickness={0}
        yAxisThickness={0}
        hideYAxisText
        hideRules
        initialSpacing={10}
        endSpacing={10}
        curved
        areaChart
        startFillColor={accent}
        endFillColor={accent}
        startOpacity={0.15}
        endOpacity={0.02}
        focusedDataPointIndex={selectedIndex >= 0 ? selectedIndex : undefined}
        focusEnabled
        showDataPointOnFocus
        showStripOnFocus
        stripHeight={160}
        stripWidth={1.5}
        stripColor={muted}
        stripOpacity={0.6}
        focusedDataPointColor={accent}
        focusedDataPointRadius={5}
        onPress={(item, index) => {
          if (onSelectDay && data[index]) {
            onSelectDay(data[index].day);
          }
        }}
        pointerConfig={{
          persistPointer: false,
          pointerStripHeight: 160,
          pointerStripWidth: 1.5,
          pointerStripColor: muted,
          pointerStripUptoDataPoint: true,
          pointerColor: accent,
          pointerRadius: 5,
          pointerWidth: 8,
          pointerHeight: 8,
        }}
      />
  );
}

const styles = StyleSheet.create({});
