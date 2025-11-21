import React from 'react';
import PaystackPop from '@paystack/inline-js';

interface PaystackIntegrationProps {
    email: string;
    amount: number; // Amount in kobo (e.g. 5000 = 50 NGN)
    onSuccess?: (transaction: any) => void;
    onClose?: () => void;
    text?: string;
    className?: string;
}

const PaystackIntegration: React.FC<PaystackIntegrationProps> = ({ email, amount, onSuccess, onClose, text = "Pay with Paystack", className }) => {
    const payWithPaystack = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();

        const paystack = new PaystackPop();
        paystack.newTransaction({
            key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
            email: email,
            amount: amount,
            onSuccess: (transaction: any) => {
                console.log(transaction);
                if (onSuccess) {
                    onSuccess(transaction);
                }
            },
            onCancel: () => {
                if (onClose) {
                    onClose();
                }
            }
        });
    };

    return (
        <button className={className} onClick={payWithPaystack}>
            {text}
        </button>
    );
};

export default PaystackIntegration;
