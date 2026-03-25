"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getStoredToken } from '@/utils/authStorage';
import { useMessage } from './MessageContext';

const SocketContext = createContext();

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const { showMessage } = useMessage();

    const API_URL = process.env.NEXT_PUBLIC_WEBSOCKET_HOST || 'http://localhost:4000';
    const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');

    useEffect(() => {
        const token = getStoredToken();
        
        const newSocket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            withCredentials: true,
            reconnectionAttempts: 5,
        });

        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
            setConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
            setConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            setConnected(false);
        });

        newSocket.on('registration:new', (registration) => {
            showMessage(`New registration: ${registration.user?.fullName || 'Visitor'}`, 'success');
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, []);

    const emit = useCallback((event, data) => {
        if (socket) {
            socket.emit(event, data);
        }
    }, [socket]);

    const on = useCallback((event, callback) => {
        if (socket) {
            socket.on(event, callback);
            return () => socket.off(event, callback);
        }
    }, [socket]);

    const value = {
        socket,
        connected,
        emit,
        on
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
