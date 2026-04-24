export type Category = {
  id: string;
  name: string;
  subtitle: string;
  tone: string;
};

export type Product = {
  id: string;
  name: string;
  grams: string;
  eta: string;
  image: string;
  price: string;
  tone: string;
  offerTag: string;
  itemGroup?: string;
  totalSellers: number;
};

export const categories: Category[] = [
  {id: '1', name: 'All', subtitle: 'Everything', tone: '#ececec'},
  {id: '2', name: 'Dairy & Eggs', subtitle: 'Milk and protein', tone: '#dff0ff'},
  {id: '3', name: 'Fruits', subtitle: 'Fresh picks', tone: '#ffe7c8'},
  {id: '4', name: 'Vegetables', subtitle: 'Daily stock', tone: '#d9f6de'},
  {id: '5', name: 'Snacks', subtitle: 'Quick bites', tone: '#ffe2ef'},
];

export const products: Product[] = [
  {
    id: '1',
    name: 'Banana Robusta',
    grams: '500 g',
    eta: '10 mins',
    image: 'https://loremflickr.com/320/320/banana,grocery?lock=201',
    price: '1.49',
    tone: '#fff0c2',
    offerTag: '20% OFF',
    totalSellers: 124,
  },
  {
    id: '2',
    name: 'Full Cream Milk',
    grams: '1 L',
    eta: '12 mins',
    image: 'https://loremflickr.com/320/320/milk,dairy?lock=202',
    price: '2.20',
    tone: '#e1f1ff',
    offerTag: '15% OFF',
    totalSellers: 89,
  },
  {
    id: '3',
    name: 'Potato Chips',
    grams: '150 g',
    eta: '9 mins',
    image: 'https://loremflickr.com/320/320/chips,snack?lock=203',
    price: '1.10',
    tone: '#ffe5ed',
    offerTag: '10% OFF',
    totalSellers: 203,
  },
  {
    id: '4',
    name: 'Brown Bread',
    grams: '400 g',
    eta: '11 mins',
    image: 'https://loremflickr.com/320/320/bread,bakery?lock=204',
    price: '1.90',
    tone: '#f7e9ce',
    offerTag: '12% OFF',
    totalSellers: 76,
  },
];
