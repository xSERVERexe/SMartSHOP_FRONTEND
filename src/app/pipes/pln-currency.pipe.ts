import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'pln',
})
export class PlnCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    const amount = Number(value ?? 0);
    return `${amount.toFixed(2)} zł`;
  }
}
