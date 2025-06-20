import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Response } from 'express';

describe('AuthService', () => {
  let service: AuthService;

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockResponse = {
    cookie: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should throw ForbiddenException if user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login(
          { username: 'test@example.com', password: '1234' },
          mockResponse,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if password does not match', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        password: 'hashed',
        id: 1,
      });

      jest.spyOn(argon2, 'verify').mockResolvedValue(false);

      await expect(
        service.login(
          { username: 'test@example.com', password: 'wrongpass' },
          mockResponse,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should set cookies if login is successful', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        password: 'hashed',
        id: 1,
      });

      jest.spyOn(argon2, 'verify').mockResolvedValue(true);

      mockJwtService.sign
        .mockReturnValueOnce('refreshToken')
        .mockReturnValueOnce('accessToken');

      await service.login(
        { username: 'test@example.com', password: 'correct-password' },
        mockResponse,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refreshToken',
        expect.objectContaining({ httpOnly: true }),
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'accessToken',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should return nothing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'test@gmail.com',
        password: '#Test123',
      });

      await expect(
        service.login(
          { username: 'test@gmail.com', password: '#Test123' },
          mockResponse,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('signup', () => {
    const mockSignupDto = {
      username: 'test@gmail.com',
      password: '#Test123',
      name: 'Dan',
    };

    const mockUser = {
      id: 1,
      email: 'test@gmail.com',
      password: 'hashedpassword',
      name: 'Dan',
    };
    it('should not return password', async () => {
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      jest.spyOn(argon2, 'hash').mockResolvedValue('hashedPassword');

      const result = await service.signup(mockSignupDto);
      expect(result).not.toHaveProperty('password');
    });

    it('should hash the password during signup', async () => {
      const hashedPassword = mockUser.password;
      const plainPassword = mockSignupDto.password;

      jest.spyOn(argon2, 'hash').mockResolvedValue(hashedPassword);

      mockPrismaService.user.create.mockResolvedValue({
        mockUser,
      });

      await service.signup(mockSignupDto);

      expect(argon2.hash).toHaveBeenCalledWith(plainPassword);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: mockSignupDto.username,
          password: hashedPassword,
          name: mockSignupDto.name,
        },
      });
    });
  });
});
