import React from 'react';
import { Purchase } from './Purchase';

export const ImportPurchase = (props) => {
  return <Purchase {...props} purchaseMode="import" />;
};

export default ImportPurchase;
