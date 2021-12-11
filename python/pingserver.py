
import socket
import struct
import os
import time
from enum import Enum


class Messages(Enum):
    ECHO_REPLY = 0
    SOURCE_QUENCH = 3
    REDIRECT_MESSAGE = 5
    ECHO_REQUEST = 8
    ROUTER_ADVERTISEMENT = 9
    ROUTER_SOLICITATION = 10
    TIME_EXCEEDED = 11
    PARAMETER_PROBLEM = 12
    TIMESTAMP = 13
    TIMESTAMP_REPLY = 14
    INFORMATION_REQUEST = 15
    INFORMATION_REPLY = 16
    ADDRESS_MASK_REQUEST = 17
    ADDRESS_MASK_REPLY = 18
    TRACEROUTE = 30
    EXTENDED_ECHO_REQUEST = 42
    EXTENDED_ECH_REPLY = 43


class Packet:
    sequence = 0

    def __init__(self, type, code=0, sequence=None):
        self._type = type
        self._code = code
        self._id = os.getpid() & 0xffff

        if isinstance(sequence, int):
            self._sequence = sequence
        else:
            self._sequence = Packet.sequence = Packet.sequence + 1
    
    def __str__(self):
        return 'Packet(' + str(self._type) + ',' + str(self._code) + ')'

    def to_buffer(self):
        checksum = 0
        buffer = struct.pack(
            '!2B3H4B',
            self._type,
            self._code,
            checksum,
            self._id,
            self._sequence,
            0, 0, 0, 0)
        checksum = Packet.__checksum(buffer)
        buffer = struct.pack(
            '!2B3H4B',
            self._type,
            self._code,
            checksum,
            self._id,
            self._sequence,
            0, 0, 0, 0)
        return buffer

    @staticmethod
    def from_buffer(buffer, offset):
        type = struct.unpack_from('!B', buffer, offset)[0]
        code = struct.unpack_from('!B', buffer, offset + 1)[0]
        sequence = struct.unpack_from('!H', buffer, offset + 6)[0]
        return Packet(type, code, sequence)

    @staticmethod
    def __checksum(data):
        sum = 0
        data += b'\x00'

        for i in range(0, len(data) - 1, 2):
            sum += (data[i] << 8) + data[i + 1]
            sum  = (sum & 0xffff) + (sum >> 16)

        sum = ~sum & 0xffff

        return sum

class PingServer:
    @staticmethod
    def ping(destination, ttl, timeout, client=None, buffer=None):
        raw = socket.socket(
            family=socket.AF_INET,
            type=socket.SOCK_RAW,
            proto=socket.IPPROTO_ICMP)
        destination = socket.getaddrinfo(
            host=destination,
            port=None,
            family=socket.AF_INET,
            type=socket.SOCK_RAW,
            proto=socket.IPPROTO_ICMP)[0][4]

        client = client if client else raw;
        buffer = buffer if buffer else Packet(Messages.ECHO_REQUEST.value).to_buffer()

        if ttl:
            client.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, ttl)

        start = time.time()
        client.sendto(buffer, destination)
        raw.settimeout(timeout / 1000.0)

        try:
            response = raw.recvfrom(1024)
        except socket.timeout:
            return None
        
        end = time.time()
        raw.close()

        return {
            "response": Packet.from_buffer(response[0], 20),
            "address": response[1][0],
            "time": (end - start) * 1000.0
        }

# print(PingServer().ping('8.8.8.8', 2, 5000, None, None))
